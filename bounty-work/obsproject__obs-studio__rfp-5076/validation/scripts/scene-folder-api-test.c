/* Local validation plugin: exercises the new scene folder frontend API. */
#include <obs-module.h>
#include <obs-frontend-api.h>

OBS_DECLARE_MODULE()

static int folder_events = 0;

static void log_folders(const char *label)
{
	char **names = obs_frontend_get_scene_folder_names();
	blog(LOG_INFO, "[api-test] %s folders:", label);
	for (char **name = names; name && *name; name++)
		blog(LOG_INFO, "[api-test]   '%s'", *name);
	bfree(names);
}

static void log_folder_of(const char *scene_name)
{
	obs_source_t *scene = obs_get_source_by_name(scene_name);
	char *folder = obs_frontend_get_scene_folder(scene);
	blog(LOG_INFO, "[api-test] folder of '%s' = %s", scene_name, folder ? folder : "(none)");
	bfree(folder);
	obs_source_release(scene);
}

static void on_event(enum obs_frontend_event event, void *data)
{
	(void)data;

	if (event == OBS_FRONTEND_EVENT_SCENE_FOLDERS_CHANGED) {
		folder_events++;
		return;
	}

	if (event != OBS_FRONTEND_EVENT_FINISHED_LOADING)
		return;

	log_folders("initial");
	log_folder_of("Game");
	log_folder_of("Starting Soon");

	struct obs_frontend_source_list list = {0};
	obs_frontend_get_scene_folder_scenes("Components", &list);
	for (size_t i = 0; i < list.sources.num; i++)
		blog(LOG_INFO, "[api-test] Components contains '%s'", obs_source_get_name(list.sources.array[i]));
	obs_frontend_source_list_free(&list);

	blog(LOG_INFO, "[api-test] add 'API Folder' = %d", obs_frontend_add_scene_folder("API Folder"));
	blog(LOG_INFO, "[api-test] add duplicate 'API Folder' = %d", obs_frontend_add_scene_folder("API Folder"));

	obs_source_t *game = obs_get_source_by_name("Game");
	blog(LOG_INFO, "[api-test] set 'Game' -> 'API Folder' = %d", obs_frontend_set_scene_folder(game, "API Folder"));
	obs_source_release(game);
	log_folder_of("Game");

	obs_source_t *ending = obs_get_source_by_name("Ending");
	blog(LOG_INFO, "[api-test] set 'Ending' -> 'Created By Set' = %d",
	     obs_frontend_set_scene_folder(ending, "Created By Set"));
	log_folder_of("Ending");
	blog(LOG_INFO, "[api-test] set 'Ending' -> NULL = %d", obs_frontend_set_scene_folder(ending, NULL));
	obs_source_release(ending);
	log_folder_of("Ending");

	blog(LOG_INFO, "[api-test] remove 'Empty Folder' = %d", obs_frontend_remove_scene_folder("Empty Folder"));
	blog(LOG_INFO, "[api-test] remove missing folder = %d", obs_frontend_remove_scene_folder("Does Not Exist"));
	log_folders("final");

	char **scenes = obs_frontend_get_scene_names();
	for (char **name = scenes; name && *name; name++)
		blog(LOG_INFO, "[api-test] obs_frontend_get_scene_names: '%s'", *name);
	bfree(scenes);

	blog(LOG_INFO, "[api-test] OBS_FRONTEND_EVENT_SCENE_FOLDERS_CHANGED received %d times", folder_events);

	/* Same path as a "switch to scene" hotkey: the scene is inside the collapsed "Components" folder */
	obs_source_t *alerts = obs_get_source_by_name("Alerts");
	obs_frontend_set_current_scene(alerts);
	obs_source_release(alerts);
	obs_source_t *current = obs_frontend_get_current_scene();
	blog(LOG_INFO, "[api-test] current scene after switch = '%s'", obs_source_get_name(current));
	obs_source_release(current);
}

bool obs_module_load(void)
{
	obs_frontend_add_event_callback(on_event, NULL);
	return true;
}
