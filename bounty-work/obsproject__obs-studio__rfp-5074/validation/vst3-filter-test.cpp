/*
 * Focused validation harness for the obs-vst3 filter (not part of the patch).
 *
 * Starts libobs headless (audio + an OpenGL video pipeline on Xvfb so that
 * video_tick runs), loads the obs-vst3 module, and drives the real
 * "vst3_filter" source through public libobs APIs with the Steinberg SDK
 * sample plug-ins (AGain, AGain SideChain).
 *
 * usage: vst3-filter-test <module.so> <module data dir> <config dir> <libobs data dir> [stereo|5.1] [--editor <png>]
 */

#include <obs.h>
#include <obs-module.h>
#include <obs-nix-platform.h>
#include <util/base.h>
#include <util/platform.h>

#include <X11/Xlib.h>

#include <atomic>
#include <chrono>
#include <cmath>
#include <condition_variable>
#include <cstdio>
#include <cstring>
#include <deque>
#include <functional>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include <dirent.h>
#include <signal.h>
#include <unistd.h>

namespace {

int failures = 0;

#define CHECK(condition, ...)                                   \
	do {                                                    \
		if (condition) {                                \
			printf("PASS: ");                       \
		} else {                                        \
			printf("FAIL: ");                       \
			failures++;                             \
		}                                               \
		printf(__VA_ARGS__);                            \
		printf("\n");                                   \
		fflush(stdout);                                 \
	} while (0)

/* ---------------------------------------------------------------- UI task queue */

std::mutex taskMutex;
std::condition_variable taskCondition;
std::deque<std::pair<obs_task_t, void *>> tasks;

void uiTaskHandler(obs_task_t task, void *param, bool wait)
{
	if (wait) {
		/* Not used by obs-vst3; run inline. */
		task(param);
		return;
	}
	std::lock_guard<std::mutex> lock(taskMutex);
	tasks.emplace_back(task, param);
	taskCondition.notify_all();
}

void pumpUiTasks()
{
	std::deque<std::pair<obs_task_t, void *>> pending;
	{
		std::lock_guard<std::mutex> lock(taskMutex);
		pending.swap(tasks);
	}
	for (auto &task : pending) {
		task.first(task.second);
	}
}

void pumpFor(int milliseconds)
{
	auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(milliseconds);
	while (std::chrono::steady_clock::now() < deadline) {
		pumpUiTasks();
		std::this_thread::sleep_for(std::chrono::milliseconds(10));
	}
	pumpUiTasks();
}

/* ---------------------------------------------------------------- test audio source */

const char *toneName(void *)
{
	return "Test tone";
}

void *toneCreate(obs_data_t *, obs_source_t *source)
{
	return source;
}

void toneDestroy(void *) {}

void registerToneSource()
{
	obs_source_info info = {};
	info.id = "vst3_test_tone";
	info.type = OBS_SOURCE_TYPE_INPUT;
	info.output_flags = OBS_SOURCE_AUDIO | OBS_SOURCE_ASYNC;
	info.get_name = toneName;
	info.create = toneCreate;
	info.destroy = toneDestroy;
	obs_register_source(&info);
}

struct Capture {
	std::mutex mutex;
	std::vector<std::vector<float>> channels;
};

void captureCallback(void *param, obs_source_t *, const struct audio_data *audio, bool)
{
	auto *capture = static_cast<Capture *>(param);
	std::lock_guard<std::mutex> lock(capture->mutex);
	for (size_t channel = 0; channel < capture->channels.size(); channel++) {
		const float *data = reinterpret_cast<const float *>(audio->data[channel]);
		if (data) {
			capture->channels[channel].insert(capture->channels[channel].end(), data,
							  data + audio->frames);
		}
	}
}

uint64_t timestamp = 0;

/* Outputs one block of planar float audio on `source` and returns the filtered result. */
std::vector<std::vector<float>> runBlock(obs_source_t *source, Capture &capture, uint32_t channels, uint32_t frames,
					 const std::function<float(uint32_t channel, uint32_t frame)> &generator)
{
	std::vector<std::vector<float>> planes(channels, std::vector<float>(frames));
	for (uint32_t channel = 0; channel < channels; channel++) {
		for (uint32_t frame = 0; frame < frames; frame++) {
			planes[channel][frame] = generator(channel, frame);
		}
	}

	obs_source_audio audio = {};
	for (uint32_t channel = 0; channel < channels; channel++) {
		audio.data[channel] = reinterpret_cast<const uint8_t *>(planes[channel].data());
	}
	audio.frames = frames;
	audio.samples_per_sec = 48000;
	audio.format = AUDIO_FORMAT_FLOAT_PLANAR;
	audio.speakers = channels == 6 ? SPEAKERS_5POINT1 : SPEAKERS_STEREO;
	timestamp = timestamp ? timestamp + util_mul_div64(frames, 1000000000ULL, 48000) : os_gettime_ns();
	audio.timestamp = timestamp;

	{
		std::lock_guard<std::mutex> lock(capture.mutex);
		for (auto &channel : capture.channels) {
			channel.clear();
		}
	}

	obs_source_output_audio(source, &audio);

	std::lock_guard<std::mutex> lock(capture.mutex);
	return capture.channels;
}

float sine(uint32_t channel, uint32_t frame)
{
	return 0.8f * std::sin(2.0f * float(M_PI) * 440.0f * float(frame) / 48000.0f + float(channel));
}

/* Largest |out - expectedGain * in| over the block (channels limited to `count`). */
double gainError(const std::vector<std::vector<float>> &output, uint32_t firstChannel, uint32_t count,
		 uint32_t frames, double expectedGain)
{
	double error = 0.0;
	for (uint32_t channel = firstChannel; channel < firstChannel + count; channel++) {
		if (output[channel].size() != frames) {
			return 1e9;
		}
		for (uint32_t frame = 0; frame < frames; frame++) {
			double expected = expectedGain * sine(channel, frame);
			error = std::max(error, std::fabs(output[channel][frame] - expected));
		}
	}
	return error;
}

/* ---------------------------------------------------------------- helpers */

std::vector<std::string> listPlugins(obs_source_t *filter)
{
	std::vector<std::string> values;
	obs_properties_t *properties = obs_source_properties(filter);
	obs_property_t *list = obs_properties_get(properties, "plugin");
	for (size_t index = 0; index < obs_property_list_item_count(list); index++) {
		values.push_back(std::string(obs_property_list_item_name(list, index)) + "=" +
				 obs_property_list_item_string(list, index));
	}
	obs_properties_destroy(properties);
	return values;
}

std::string findPlugin(obs_source_t *filter, const std::string &name)
{
	for (const std::string &entry : listPlugins(filter)) {
		if (entry.rfind(name + " (", 0) == 0) {
			return entry.substr(entry.find('=') + 1);
		}
	}
	return "";
}

std::vector<int> hostProcesses()
{
	std::vector<int> pids;
	DIR *proc = opendir("/proc");
	while (dirent *entry = readdir(proc)) {
		int pid = atoi(entry->d_name);
		if (pid <= 0) {
			continue;
		}
		char path[64];
		snprintf(path, sizeof(path), "/proc/%d/stat", pid);
		FILE *stat = fopen(path, "r");
		if (!stat) {
			continue;
		}
		char comm[256] = {};
		char state = 0;
		int parent = 0;
		if (fscanf(stat, "%*d (%255[^)]) %c %d", comm, &state, &parent) == 3 && parent == getpid() &&
		    strcmp(comm, "obs-vst3-host") == 0 && state != 'Z') {
			pids.push_back(pid);
		}
		fclose(stat);
	}
	closedir(proc);
	return pids;
}

bool pressButton(obs_source_t *filter, const char *name)
{
	obs_properties_t *properties = obs_source_properties(filter);
	obs_property_t *button = obs_properties_get(properties, name);
	bool visible = button && obs_property_visible(button);
	if (visible) {
		obs_property_button_clicked(button, filter);
	}
	obs_properties_destroy(properties);
	return visible;
}

std::string statusText(obs_source_t *filter)
{
	obs_properties_t *properties = obs_source_properties(filter);
	obs_property_t *status = obs_properties_get(properties, "status");
	std::string text = status ? obs_property_description(status) : "";
	obs_properties_destroy(properties);
	return text;
}

int shell(const std::string &command)
{
	return system(command.c_str());
}

bool windowExists(const std::string &titlePrefix)
{
	return shell("xwininfo -root -tree | grep -F '\"" + titlePrefix + "' > /dev/null") == 0;
}

} // namespace

int main(int argc, char **argv)
{
	if (argc < 5) {
		fprintf(stderr, "usage: %s <module.so> <module data> <config dir> <libobs data> [stereo|5.1] [--editor <png>]\n",
			argv[0]);
		return 2;
	}

	std::string modulePath = argv[1];
	std::string moduleData = argv[2];
	std::string configDir = argv[3];
	std::string libobsData = argv[4];
	bool surround = argc > 5 && std::string(argv[5]) == "5.1";
	std::string editorScreenshot;
	for (int index = 5; index + 1 < argc; index++) {
		if (std::string(argv[index]) == "--editor") {
			editorScreenshot = argv[index + 1];
		}
	}
	uint32_t channels = surround ? 6 : 2;
	const uint32_t frames = 1024;

	Display *display = XOpenDisplay(nullptr);
	if (!display) {
		fprintf(stderr, "No X display (run under xvfb-run)\n");
		return 2;
	}

	obs_set_nix_platform(OBS_NIX_PLATFORM_X11_EGL);
	obs_set_nix_platform_display(display);
	if (!obs_startup("en-US", configDir.c_str(), nullptr)) {
		fprintf(stderr, "obs_startup failed\n");
		return 2;
	}
	obs_set_ui_task_handler(uiTaskHandler);
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wdeprecated-declarations"
	obs_add_data_path(libobsData.c_str());
#pragma GCC diagnostic pop

	obs_audio_info audioInfo = {48000, surround ? SPEAKERS_5POINT1 : SPEAKERS_STEREO};
	CHECK(obs_reset_audio(&audioInfo), "obs_reset_audio (%s, 48 kHz)", surround ? "5.1" : "stereo");

	obs_video_info videoInfo = {};
	videoInfo.graphics_module = "libobs-opengl";
	videoInfo.fps_num = 30;
	videoInfo.fps_den = 1;
	videoInfo.base_width = videoInfo.output_width = 64;
	videoInfo.base_height = videoInfo.output_height = 64;
	videoInfo.output_format = VIDEO_FORMAT_NV12;
	videoInfo.gpu_conversion = true;
	videoInfo.colorspace = VIDEO_CS_709;
	videoInfo.range = VIDEO_RANGE_PARTIAL;
	videoInfo.scale_type = OBS_SCALE_BICUBIC;
	int videoResult = obs_reset_video(&videoInfo);
	CHECK(videoResult == OBS_VIDEO_SUCCESS, "obs_reset_video (video_tick drives sidechain + crash recovery): %d",
	      videoResult);

	registerToneSource();

	obs_module_t *module = nullptr;
	int openResult = obs_open_module(&module, modulePath.c_str(), moduleData.c_str());
	CHECK(openResult == MODULE_SUCCESS && obs_init_module(module), "obs-vst3 module loaded and initialized");

	obs_source_t *tone = obs_source_create("vst3_test_tone", "tone", nullptr, nullptr);
	Capture capture;
	capture.channels.resize(channels);
	obs_source_add_audio_capture_callback(tone, captureCallback, &capture);

	/* 1. Scanning ---------------------------------------------------------------------------------- */
	obs_source_t *probe = obs_source_create_private("vst3_filter", "probe", nullptr);
	std::string again;
	std::string againSidechain;
	for (int attempt = 0; attempt < 300 && (again.empty() || againSidechain.empty()); attempt++) {
		again = findPlugin(probe, "AGain VST3");
		againSidechain = findPlugin(probe, "AGain SideChain VST3");
		pumpFor(100);
	}
	for (const std::string &entry : listPlugins(probe)) {
		printf("      list entry: %s\n", entry.c_str());
	}
	CHECK(!again.empty() && !againSidechain.empty(),
	      "plug-in list from VST3_PATH scan contains both classes of again.vst3 (multi-class module)");
	std::string cacheFile = configDir + "/obs-vst3/plugin-cache.json";
	CHECK(os_file_exists(cacheFile.c_str()), "scan cache written to %s", cacheFile.c_str());
	obs_properties_t *typeProperties = obs_get_source_properties("vst3_filter");
	CHECK(typeProperties && obs_property_list_item_count(obs_properties_get(typeProperties, "plugin")) >= 3,
	      "type-level obs_get_source_properties(\"vst3_filter\") lists plug-ins without an instance");
	obs_properties_destroy(typeProperties);
	obs_source_release(probe);

	/* 2. Load AGain, default gain 1.0 ------------------------------------------------------------- */
	obs_data_t *settings = obs_data_create();
	obs_data_set_string(settings, "plugin", again.c_str());
	obs_source_t *filter = obs_source_create_private("vst3_filter", "VST3 test", settings);
	obs_data_release(settings);
	obs_source_filter_add(tone, filter);

	std::vector<int> hosts = hostProcesses();
	CHECK(hosts.size() == 1, "plug-in runs in a separate obs-vst3-host process (pid %d)",
	      hosts.empty() ? -1 : hosts[0]);

	auto output = runBlock(tone, capture, channels, frames, sine);
	double error = gainError(output, 0, 2, frames, 1.0);
	CHECK(error < 1e-6, "AGain default state (gain 1.0) passes a 440 Hz sine unchanged (max error %.2e)", error);
	printf("      status: %s\n", statusText(filter).c_str());

	/* 3. Restore state from settings: AGain state = float gain, float reduction, int32 bypass -------- */
	std::vector<uint8_t> state(12, 0);
	float gain = 0.25f;
	memcpy(state.data(), &gain, 4);
	static const char alphabet[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	std::string encoded;
	for (size_t index = 0; index < state.size(); index += 3) {
		uint32_t value = (state[index] << 16) | (state[index + 1] << 8) | state[index + 2];
		for (int shift = 18; shift >= 0; shift -= 6) {
			encoded.push_back(alphabet[(value >> shift) & 0x3f]);
		}
	}

	obs_source_filter_remove(tone, filter);
	obs_source_release(filter);
	for (int attempt = 0; attempt < 50 && !hostProcesses().empty(); attempt++) {
		pumpFor(100);
	}
	CHECK(hostProcesses().empty(), "removing the filter shuts its plug-in host process down");

	settings = obs_data_create();
	obs_data_set_string(settings, "plugin", again.c_str());
	obs_data_set_string(settings, "component_state", encoded.c_str());
	obs_data_set_string(settings, "controller_state", "");
	obs_data_set_string(settings, "state_plugin", again.c_str());
	filter = obs_source_create_private("vst3_filter", "VST3 test", settings);
	obs_data_release(settings);
	obs_source_filter_add(tone, filter);

	output = runBlock(tone, capture, channels, frames, sine);
	error = gainError(output, 0, 2, frames, 0.25);
	CHECK(error < 1e-6, "state restored from settings (gain 0.25) is applied by the processor (max error %.2e)",
	      error);

	if (surround) {
		error = gainError(output, 2, 4, frames, 1.0);
		CHECK(error < 1e-6,
		      "5.1: AGain is stereo-only, channels 3-6 are passed through untouched (max error %.2e)", error);
	}

	/* 4. Save: state comes back from the plug-in through getState ----------------------------------- */
	obs_source_save(filter);
	settings = obs_source_get_settings(filter);
	std::string saved = obs_data_get_string(settings, "component_state");
	std::string savedFor = obs_data_get_string(settings, "state_plugin");
	CHECK(saved == encoded && savedFor == again, "save() round-trips IComponent::getState as base64 (%s)",
	      saved.c_str());

	/* 5. A second instance created from the saved settings behaves identically ---------------------- */
	obs_source_t *tone2 = obs_source_create("vst3_test_tone", "tone2", nullptr, nullptr);
	Capture capture2;
	capture2.channels.resize(channels);
	obs_source_add_audio_capture_callback(tone2, captureCallback, &capture2);
	obs_source_t *filter2 = obs_source_create_private("vst3_filter", "VST3 copy", settings);
	obs_data_release(settings);
	obs_source_filter_add(tone2, filter2);
	timestamp = 0;
	output = runBlock(tone2, capture2, channels, frames, sine);
	error = gainError(output, 0, 2, frames, 0.25);
	CHECK(error < 1e-6, "second filter loaded from saved settings applies gain 0.25 (max error %.2e)", error);
	obs_source_filter_remove(tone2, filter2);
	obs_source_release(filter2);
	obs_source_remove_audio_capture_callback(tone2, captureCallback, &capture2);
	obs_source_release(tone2);
	pumpFor(200);

	/* 6. Variable block sizes (async sources deliver arbitrary sizes) ----------------------------------- */
	timestamp = 0;
	bool blockSizesOk = true;
	for (uint32_t blockFrames : {64u, 480u, 1024u, 1500u, 4096u}) {
		output = runBlock(tone, capture, channels, blockFrames, sine);
		error = gainError(output, 0, 2, blockFrames, 0.25);
		blockSizesOk = blockSizesOk && error < 1e-6;
		printf("      %u frames: max error %.2e\n", blockFrames, error);
	}
	CHECK(blockSizesOk, "blocks of 64/480/1024/1500/4096 frames are processed (chunked to 1024)");

	/* 7. IPC cost ------------------------------------------------------------------------------------ */
	const int iterations = 2000;
	auto start = std::chrono::steady_clock::now();
	for (int iteration = 0; iteration < iterations; iteration++) {
		runBlock(tone, capture, channels, frames, sine);
	}
	double microseconds =
		std::chrono::duration<double, std::micro>(std::chrono::steady_clock::now() - start).count() / iterations;
	printf("INFO: %.1f us per 1024-frame block including libobs, shared-memory copy and socket round trip "
	       "(block length is 21333 us)\n",
	       microseconds);

	/* 8. Editor on X11 (Xvfb) ------------------------------------------------------------------------ */
	if (!editorScreenshot.empty()) {
		CHECK(pressButton(filter, "open_editor"), "\"Open Plug-in Interface\" button is visible and clicked");
		/* Keep audio flowing while the editor is open (its VU meter is fed by output parameters). */
		for (int iteration = 0; iteration < 100; iteration++) {
			runBlock(tone, capture, channels, frames, sine);
			pumpFor(20);
		}
		bool exists = windowExists("AGain VST3 - VST3 test");
		CHECK(exists, "editor window \"AGain VST3 - VST3 test\" created by the host process");
		shell("xwininfo -root -tree | grep -A3 'AGain VST3 - VST3 test' | sed 's/^/      /'");
		std::string command = "import -window \"$(xdotool search --name 'AGain VST3 - VST3 test' | head -1)\" " +
				      editorScreenshot;
		shell(command);
		CHECK(os_file_exists(editorScreenshot.c_str()), "screenshot written to %s", editorScreenshot.c_str());

		/* Drag the gain slider in the plug-in GUI: IComponentHandler::performEdit -> processor. */
		uint32_t editsBefore = 0;
		shell("xdotool search --name 'AGain VST3 - VST3 test' | head -1 > /tmp/vst3-editor-window");
		shell("w=$(cat /tmp/vst3-editor-window); xdotool mousemove --window $w 127 98 mousedown 1 "
		       "mousemove --window $w 160 98 mousemove --window $w 200 98 mouseup 1");
		double measuredGain = 0.0;
		for (int iteration = 0; iteration < 50; iteration++) {
			output = runBlock(tone, capture, channels, frames, sine);
			pumpFor(20);
		}
		measuredGain = output[0][100] / sine(0, 100);
		(void)editsBefore;
		CHECK(std::fabs(measuredGain - 0.25) > 0.05,
		      "moving the slider in the plug-in editor changes the processed gain (now %.3f, was 0.25)",
		      measuredGain);
		pumpFor(1500);
		obs_source_save(filter);
		settings = obs_source_get_settings(filter);
		std::string afterEdit = obs_data_get_string(settings, "component_state");
		obs_data_release(settings);
		CHECK(afterEdit != encoded, "saved state reflects the edit made in the editor (%s)", afterEdit.c_str());
		command = "import -window \"$(cat /tmp/vst3-editor-window)\" " + editorScreenshot.substr(0, editorScreenshot.size() - 4) + "-after-edit.png";
		shell(command);
		CHECK(pressButton(filter, "close_editor"), "\"Close Plug-in Interface\" button is visible and clicked");
		pumpFor(500);
		CHECK(!windowExists("AGain VST3 - VST3 test"), "editor window closed");
	}

	/* 9. Crash isolation and recovery ---------------------------------------------------------------- */
	output = runBlock(tone, capture, channels, frames, sine);
	double expectedGain = output[0][100] / sine(0, 100);
	pumpFor(1500); /* let the filter take its periodic state snapshot */
	hosts = hostProcesses();
	CHECK(hosts.size() == 1, "one host process before the crash test");
	if (!hosts.empty()) {
		kill(hosts[0], SIGKILL);
		std::this_thread::sleep_for(std::chrono::milliseconds(100));
	}

	output = runBlock(tone, capture, channels, frames, sine);
	error = gainError(output, 0, 2, frames, 1.0);
	CHECK(error < 1e-6, "after SIGKILL of the plug-in host OBS keeps running and passes audio through (max error %.2e)",
	      error);
	printf("      status: %s\n", statusText(filter).c_str());

	bool recovered = false;
	for (int attempt = 0; attempt < 100 && !recovered; attempt++) {
		pumpFor(100);
		output = runBlock(tone, capture, channels, frames, sine);
		recovered = gainError(output, 0, 2, frames, expectedGain) < 1e-5;
	}
	hosts = hostProcesses();
	CHECK(recovered && hosts.size() == 1,
	      "host restarted automatically (pid %d) and the last known state (gain %.3f) was restored",
	      hosts.empty() ? -1 : hosts[0], expectedGain);

	obs_source_filter_remove(tone, filter);
	obs_source_release(filter);
	pumpFor(200);

	/* 10. Sidechain through the compressor-style capture path --------------------------------------- */
	if (!surround) {
		obs_source_t *key = obs_source_create("vst3_test_tone", "sidechain key", nullptr, nullptr);
		Capture keyCapture;
		keyCapture.channels.resize(channels);

		settings = obs_data_create();
		obs_data_set_string(settings, "plugin", againSidechain.c_str());
		obs_data_set_string(settings, "sidechain_source", "sidechain key");
		filter = obs_source_create_private("vst3_filter", "VST3 sidechain", settings);
		obs_data_release(settings);
		obs_source_filter_add(tone, filter);

		/* video_tick connects to the sidechain source by name */
		pumpFor(500);

		obs_properties_t *properties = obs_source_properties(filter);
		bool sidechainVisible = obs_property_visible(obs_properties_get(properties, "sidechain_source"));
		obs_properties_destroy(properties);
		CHECK(sidechainVisible, "\"Sidechain Source\" list is shown for a plug-in with an aux input bus");

		uint64_t keyTimestamp = os_gettime_ns();
		timestamp = keyTimestamp;
		bool sidechainOk = false;
		double lastValue = 0.0;
		for (int iteration = 0; iteration < 20; iteration++) {
			std::vector<std::vector<float>> keyPlanes(channels, std::vector<float>(frames, 0.1f));
			obs_source_audio keyAudio = {};
			for (uint32_t channel = 0; channel < channels; channel++) {
				keyAudio.data[channel] = reinterpret_cast<const uint8_t *>(keyPlanes[channel].data());
			}
			keyAudio.frames = frames;
			keyAudio.samples_per_sec = 48000;
			keyAudio.format = AUDIO_FORMAT_FLOAT_PLANAR;
			keyAudio.speakers = SPEAKERS_STEREO;
			keyAudio.timestamp = keyTimestamp;
			keyTimestamp += util_mul_div64(frames, 1000000000ULL, 48000);
			obs_source_output_audio(key, &keyAudio);

			output = runBlock(tone, capture, channels, frames, [](uint32_t, uint32_t) { return 0.2f; });
			lastValue = output[0].empty() ? 0.0 : output[0][frames / 2];
			sidechainOk = sidechainOk || std::fabs(lastValue - 0.3) < 1e-6;
		}
		CHECK(sidechainOk,
		      "AGain SideChain mixes the mono-downmixed key into its output: 0.2 + 0.1 = %.4f (expected 0.3)",
		      lastValue);

		obs_source_filter_remove(tone, filter);
		obs_source_release(filter);
		obs_source_release(key);
		pumpFor(200);
	}

	obs_source_remove_audio_capture_callback(tone, captureCallback, &capture);
	obs_source_release(tone);
	for (int attempt = 0; attempt < 50 && !hostProcesses().empty(); attempt++) {
		pumpFor(100);
	}
	CHECK(hostProcesses().empty(), "no plug-in host processes left behind");

	obs_shutdown();
	XCloseDisplay(display);

	printf("\n%s: %d failure(s)\n", failures ? "FAILED" : "ALL PASSED", failures);
	return failures ? 1 : 0;
}
