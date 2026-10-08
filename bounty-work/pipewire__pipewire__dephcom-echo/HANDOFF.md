# HANDOFF: pipewire/pipewire#4170, echo cancellation through `filter.want` / `filter.apply` in pipewire-pulse

**Status: HANDOFF (ready for submission).** The full feature is implemented, has unit and end-to-end tests, and includes a 1.4 backport for Mobian Trixie.

| | |
|---|---|
| Upstream | https://gitlab.freedesktop.org/pipewire/pipewire (GitLab, submit as a merge request) |
| Issue | https://gitlab.freedesktop.org/pipewire/pipewire/-/issues/4170 ("Enable echo cancel using the PipeWire API"). Open, label `enhancement`, 7 notes, 0 linked MRs (checked 2026-10-08) |
| Bounty | https://opencollective.com/dephcom/projects/pipewire-echo ("Echo cancellation with PipeWire", DEPHCOM) |
| Platform | Open Collective. Fiscal host: Open Source Collective |
| Amount | **$1,893.68 USD** (project balance on 2026-10-08) |
| Base (master) | `master@b37700cb2083d68477cef9002d1f676dff796f3c` ("wavfile: fix F64_LE bits", 2026-10-07). Re-checked after `git fetch`, still the tip |
| Base (backport) | `1.4@d0c07860fac576c952ab816628dadac786977238` ("pod: reject choices with no values") |
| Files | `fix.patch` (master, `git format-patch`), `fix-1.4-backport.patch` (1.4 branch, the PipeWire series in Debian/Mobian Trixie), `test-filter-apply.sh` (headless end-to-end test), this file |
| Submit as | woahwhattheheck (the commit author is `woahwhattheheck <293286387+woahwhattheheck@users.noreply.github.com>`) |

## Payout terms and evidence

- On the project page, the organizers say they "will pay the amount raised to anyone who coordinate with us and fix the issue on Mobian Trixie". **Coordinating with DEPHCOM is part of the payout condition** (see the message draft below).
- Organizer: Pirate Praveen. Open Collective admins: Badri, Ravi Dwivedi and devrtz. Contact channels: codema.in thread https://codema.in/d/28iTnfUa/echo-cancellation-for-calls-with-pipewire-on-librem-5, Matrix `#debphoshfund:fortysixandtwo.eu`, XMPP `debphoshfund@chat.disroot.org`.
- Funding: contributions include $2,000 from gondolyr (2025-08-29) plus smaller donations. The page shows a balance of $1,893.68 and **$0 disbursed** so far.
- No history of the program refusing to pay. It is a young collective and this is its only project. Open Source Collective pays out any expense the collective admins approve.
- Upstream note: Arun Raghavan (PipeWire developer) suggested a filter.want-driven approach to the organizers (codema.in, 2025-10-09). This patch implements that approach inside pipewire-pulse itself, matching the PulseAudio module-filter-heuristics + module-filter-apply behaviour.

## Competition

- **MR !3034** (https://gitlab.freedesktop.org/pipewire/pipewire/-/merge_requests/3034) by `franklincg`, opened 2026-10-02 and still open. It has 4 notes, and its merge status was "unchecked" on 2026-10-08.
  - It adds a `filter-request.h` classifier and link tracking. In its own words its reconcile code is "Observation only": it never loads `module-echo-cancel`, never routes a stream and never unloads anything. Apps that set `filter.want=echo-cancel` therefore still get no echo cancellation.
  - **This patch is the complete feature.** It loads or reuses the filter, routes both streams of a call through it, follows device moves and removals, unloads the filter when it is unused, and has a config switch and docs. It is validated end-to-end on WirePlumber 0.4.17 and 0.5.8 and ships a 1.4 backport for Mobian Trixie.
- On 2026-09-10 Franklin asked the DEPHCOM organizers on codema.in for the bounty, and Praveen replied that it was still available. The submitter should therefore contact the organizers when opening the MR (message draft below), because coordination is their stated condition.
- Slack: no other fleet TAKE for this issue. Our TAKE: https://tokenjunkielabs.slack.com/archives/C0BVANHNB26/p1791431432542909

## Problem / root cause

When a client of pipewire-pulse (the PulseAudio server in PipeWire) creates a stream with the PulseAudio properties `filter.want=echo-cancel` / `filter.apply=echo-cancel`, the server ignores them. Jami does exactly this through `PA_PROP_FILTER_WANT`, and so do the call setups on the Librem 5 and PinePhone. PulseAudio implemented this behaviour with `module-filter-heuristics` and `module-filter-apply`, both loaded by default. pipewire-pulse has no equivalent: no source file references `filter.want` or `filter.apply`. The only way to get echo cancellation was a static, system-wide echo-cancel configuration, so calls on Mobian Trixie (which moved to PipeWire) have echo.

## The change

New `src/modules/module-protocol-pulse/filter-apply.c` / `.h`, hooked into the pulse server:

- **Rules (PulseAudio parity), pure helpers in `filter-apply.h`:**
  - `filter.apply=<f>` always applies the filter. An empty value disables `filter.want`.
  - `filter.want=<f>` is a hint. It is ignored on devices meant for calls, meaning devices whose `device.intended-roles` contains `phone` (PulseAudio) or `Communication` (PipeWire bluez).
  - `filter.suppress=<f>` disables the filter.
  - `filter.apply.<f>.parameters` adds module arguments. They are read from the stream only when `pulse.allow-module-loading` is true, and can also be set on the device.
- **Echo-cancel grouping:** as in PulseAudio, the filter is set up once a playback stream and a record stream from the same group (`media.role` → `application.id` → `application.name` → `media.name`, with client properties as fallback) both want `echo-cancel`. Both streams are then routed through one `module-echo-cancel` with `sink_master=<playback device> source_master=<record device>`. The new devices are named `<master>.echo-cancel`, so they can't clash with a statically configured echo-canceller. Streams that already sit on an echo-canceller (one we loaded, one loaded with pactl, or a static `libpipewire-module-echo-cancel`) are left alone. Other filters work generically: any pulse module that takes `sink_master` / `source_master`, such as ladspa-sink and ladspa-source.
- **Reuse and unload:** filter instances are shared, keyed on (filter, sink master, source master, parameters). An instance is unloaded 10 s after the last stream stops using it, which matches the module-filter-apply housekeeping interval.
- **Routing:** streams are moved with the `target.object` metadata, like `pactl move-*`. Only that key is written, so WirePlumber relinks once. While a stream is moved into a filter it carries `state.restore-target = "false"`, so WirePlumber 0.5's restore-stream does not save the temporary filter as that app's or role's target (PulseAudio used `save=false` for the same reason). A stream that hasn't landed on its filter after 2 s gets its move requested again, at most 3 times.
- **Dynamics:**
  - When someone else moves a filtered stream (a mixer, or metadata), we detect the `target.object` change. The filter is then applied on the new device and the pair follows, as in PulseAudio.
  - When the master device disappears, the filter is unloaded and the streams are re-filtered on whatever device they move to.
  - When the module is unloaded manually with `pactl unload-module`, the streams go back to their devices and are not filtered again until their properties change.
  - When a stream drops the request (`filter.apply` removed, or suppressed), it is moved back. A move back to the default device clears the target, the same semantics as `do_move_stream`.
- **Config:** the new `pulse.filter-apply = true` setting (default true) lives in `pulse.properties` and can switch the feature off. It is documented in `module-protocol-pulse.c` (doxygen) and commented in `pipewire-pulse.conf.in`.
- **Performance:** work is coalesced on the work queue and runs only on link, node and metadata add/remove events and on stream property changes. Streams without `filter.*` properties are skipped before any graph lookup.

### Files changed (master patch: 10 files, +1406 −2)

```
src/daemon/pipewire-pulse.conf.in                  |    1 +
src/modules/meson.build                            |   11 +   (new source + pw-test-pulse-filter-apply)
src/modules/module-protocol-pulse.c                |   43 +   (docs)
src/modules/module-protocol-pulse/filter-apply.c   | 1022 +++ (new)
src/modules/module-protocol-pulse/filter-apply.h   |  159 +++ (new, rules + API)
src/modules/module-protocol-pulse/internal.h       |    4 +
src/modules/module-protocol-pulse/pulse-server.c   |   25 +-  (hooks, defaults, init/free)
src/modules/module-protocol-pulse/stream.c         |    4 +
src/modules/module-protocol-pulse/stream.h         |    7 +
src/modules/module-protocol-pulse/test-filter-apply.c | 132 +++ (new unit test)
```

The **1.4 backport** is the same commit with three adaptations:
- 1.4's `module_info.valid_args` is a string array, and most modules describe their arguments only in `PW_KEY_MODULE_USAGE`, so `filter_supports()` checks the usage string.
- Trivial context conflicts were resolved in `pipewire-pulse.conf.in`, `module-protocol-pulse.c`, `pulse-server.c` and `stream.h`.
- A `-Werror=format-truncation` construct was avoided.

## How to apply

```bash
git clone https://gitlab.freedesktop.org/pipewire/pipewire.git && cd pipewire
git checkout master            # b37700cb2083d68477cef9002d1f676dff796f3c
git am /path/to/fix.patch
# Mobian Trixie / 1.4 series:
git checkout -b filter-apply-1.4 origin/1.4 && git am /path/to/fix-1.4-backport.patch
```

Both patches were verified with `git am` on clean checkouts of `origin/master` and `origin/1.4`.

## Validation (focused; no full test suite was run)

Build: meson, with a minimal feature set (`-Dsession-managers=[] -Decho-cancel-webrtc=enabled -Dtests=enabled …`). Ubuntu 24.04 provides webrtc-audio-processing 0.3.1, WirePlumber 0.4.17 (distro package) and WirePlumber **0.5.8**, which I built from the tag against this PipeWire build because 0.5.8 is the version Mobian Trixie ships.

1. Unit test for the rules (want/apply/suppress precedence, phone/Communication devices, grouping):
   ```
   $ meson test -C builddir pw-test-pulse-filter-apply
   1/1 pw-test-pulse-filter-apply OK              0.01s
   Ok:                 1
   Fail:               0
   ```
   This passes on both master and 1.4.

2. Headless end-to-end test, `test-filter-apply.sh <pipewire-src> [builddir]`. It starts a private pipewire, wireplumber and pipewire-pulse, creates a null `speakers` sink, a null `mic` source, a second source `mic2` and a mono `headset` sink with `device.intended-roles=Communication`, then drives streams with `pacat`/`parec`:
   ```
   $ WIREPLUMBER=…/wireplumber-0.5.8/inst/bin/wireplumber WIREPLUMBER_LIBDIR=…/lib/x86_64-linux-gnu \
     WIREPLUMBER_CONFIG_DIR=…/share/wireplumber WIREPLUMBER_DATA_DIR=…/share/wireplumber \
     ./test-filter-apply.sh ~/pipewire
   session manager: …/wireplumber 0.5.8
   == baseline: no filter request
   PASS: plain stream plays on speakers
   PASS: no echo-cancel loaded for plain stream
   == single stream with filter.want=echo-cancel (no pair yet)
   PASS: unpaired stream stays on speakers
   PASS: no echo-cancel loaded without a paired stream
   == paired record stream with filter.want=echo-cancel
   PASS: module-echo-cancel auto-loaded
   536870916  module-echo-cancel  sink_master="speakers" sink_name="speakers.echo-cancel" source_master="mic" source_name="mic.echo-cancel"
   PASS: playback routed to speakers.echo-cancel
   PASS: record routed to mic.echo-cancel
   PASS: echo-cancel playback feeds speakers
   PASS: echo-cancel capture reads mic
   == stream with filter.suppress=echo-cancel is not filtered
   PASS: suppressed stream stays on speakers
   == second call from the same group reuses the loaded filter
   PASS: second record stream routed to mic.echo-cancel
   PASS: still exactly one module-echo-cancel
   == moving a filtered stream to another device moves the filter along
   PASS: record stream re-filtered on mic2.echo-cancel
   PASS: new echo-canceller uses mic2 as source master
   PASS: playback follows to the new echo-canceller
   PASS: old echo-canceller unloaded
   == the master device goes away -> filter is rebuilt on the new device
   PASS: record stream re-filtered on mic.echo-cancel
   PASS: one echo-canceller left
   == streams end -> filter is unloaded
   PASS: module-echo-cancel unloaded when unused
   PASS: echo-cancel nodes removed
   == unloading the filter by hand puts the streams back and does not reload it
   PASS: filter loaded for the new call
   PASS: playback back on speakers
   PASS: record back on mic
   PASS: filter not reloaded
   == filter.want is ignored on devices meant for calls, filter.apply is not
   PASS: no echo-canceller for a headset call
   PASS: headset playback untouched
   PASS: explicit filter.apply loads the echo-canceller
   RESULT: PASS
   ```
   Results of the final code:

   | PipeWire | WirePlumber | Runs passed |
   |---|---|---|
   | master + patch | 0.5.8 | 6/6 |
   | master + patch | 0.4.17 | 3/3 |
   | 1.4 + backport (the Mobian Trixie stack) | 0.5.8 | 3/3 |

   The unpatched build fails every routing check. Baseline run: "module-echo-cancel auto-loaded" FAIL, and both streams stay on `speakers` / `mic`.

3. Notes from testing, for reviewers:
   - WirePlumber 0.4 compares `state.restore-target` against a boolean from its own rules and ignores the stream property, so 0.4 may remember the filter as the role's target while that filter exists. For deterministic 0.4 runs the test disables restore-target in its private 0.4 config only. 0.5 honours the property and runs with its default config.
   - Pre-existing and unrelated to this patch: `pactl move-source-output` sometimes loses its metadata update. pactl exits right after the ack, and pipewire-pulse tears the client down before the queued `pw_metadata_set_property` reaches the server. The test moves streams with `pw-metadata`, as mixers do.

## Ready-to-paste MR

**Title:** `pulse-server: apply filters requested with filter.want/filter.apply (echo-cancel)`

**Description:**

```markdown
Closes #4170

PulseAudio applications ask the server for echo cancellation per stream with
`filter.want = "echo-cancel"` (`PA_PROP_FILTER_WANT`), Jami does this for
example. PulseAudio handles this with module-filter-heuristics and
module-filter-apply, which are loaded by default; pipewire-pulse ignored the
property, so on systems that moved to PipeWire (Mobian Trixie on the Librem 5 /
PinePhone, desktops running Jami) calls have echo unless the user configures a
static echo-canceller.

This MR implements the same behaviour in pipewire-pulse:

- `filter.apply = <name>` applies `module-<name>`, `filter.want = <name>` does
  the same unless the device is meant for calls (`device.intended-roles` with
  `phone` or `Communication`), `filter.suppress = <name>` disables it and
  `filter.apply.<name>.parameters` adds module arguments (from the stream only
  when `pulse.allow-module-loading` is enabled, or from the device).
- echo-cancel is applied when a playback and a record stream of the same group
  (`media.role`, `application.id`, `application.name`, `media.name`) both want
  it: one `module-echo-cancel` is loaded with their devices as `sink_master`
  and `source_master` (devices named `<master>.echo-cancel`) and both streams
  are moved into it. Other filters work for any pulse module with
  `sink_master`/`source_master` arguments.
- filter instances are shared and unloaded 10 seconds after their last stream.
- streams are moved with the `target.object` metadata and get
  `state.restore-target = false` while they are in a filter, so the session
  manager does not remember the filter as their target.
- a filtered stream that is moved to another device gets the filter on the new
  device (the pair follows), a filter whose device disappears is unloaded and
  the streams are filtered again where they end up, a filter unloaded with
  `pactl unload-module` is not loaded again for the same streams.
- `pulse.filter-apply = false` disables the feature; documented in
  module-protocol-pulse and pipewire-pulse.conf.

Testing:
- `meson test pw-test-pulse-filter-apply` (new unit test for the rules and the
  grouping).
- A headless pipewire + wireplumber + pipewire-pulse run with null sinks and
  sources and pacat/parec streams: auto-load with both masters, routing of both
  streams, filter.suppress, reuse by a second stream, moving a stream to another
  source, removal of the master device, manual unload, unload when unused,
  phone-role devices vs explicit filter.apply. All checks pass with WirePlumber
  0.5.8 and 0.4.17. The script is available if you want it in-tree.
- The same commit applies to the 1.4 branch with small adaptations (1.4 modules
  describe their arguments in the usage string); I can open that as a separate
  MR for the 1.4 series that Debian/Mobian Trixie ship.

This MR is my submission for the DEPHCOM Open Collective bounty "Echo
cancellation with PipeWire" (https://opencollective.com/dephcom/projects/pipewire-echo),
which asks for exactly this. I'm coordinating with the DEPHCOM team on Mobian
Trixie testing and will claim the bounty through an Open Collective expense
once this is merged; I'd appreciate the payout being released on merge.
```

(If the maintainers want the MR split up, the cut points are: the rules header plus unit test, the server hooks, and the docs. The 1.4 backport goes in a separate MR targeting `1.4`.)

## Claiming the payout (Open Collective expense, after merge)

1. **Before or when the MR is opened**, post the coordination message below in the codema.in thread (and/or the Matrix room). The payout condition asks for coordination, and Franklin approached the organizers earlier.
2. Once the MR is merged on master (and, ideally, the 1.4 backport is merged or carried by Mobian), sign in to Open Collective as the submitter (woahwhattheheck).
3. Open https://opencollective.com/dephcom/projects/pipewire-echo, click **Submit Expense** (direct link: https://opencollective.com/dephcom/projects/pipewire-echo/expenses/new), and choose **Invoice**.
4. Fill in the expense:
   - Title: `PipeWire echo cancellation: filter.want/filter.apply support in pipewire-pulse (pipewire!<MR number>)`
   - Item: the same description, with the amount set to **$1,893.68** (or the project balance at that time).
   - Description: the merged MR link, the merge commit SHA, the issue link (#4170), the 1.4 backport MR link, and a short note on the Mobian Trixie test.
   - Payout method: PayPal, or bank transfer via Wise, whichever is set up on the submitter's profile. Add the legal name and address the invoice requires.
5. Submit. A collective admin (Badri, Ravi Dwivedi or devrtz) approves the expense, and Open Source Collective then pays it. If it isn't picked up within a few days, ping the expense comments and the Matrix room.

## Message draft to the sponsor (codema.in thread / Matrix `#debphoshfund:fortysixandtwo.eu`)

```text
Hi Praveen and the DEPHCOM team,

I've implemented the "Echo cancellation with PipeWire" bounty: pipewire-pulse
now honours filter.want / filter.apply like PulseAudio's module-filter-apply.
When a call app (Jami, or anything using PA_PROP_FILTER_WANT="echo-cancel")
opens its playback and record streams, pipewire-pulse loads module-echo-cancel
on the speaker + microphone it is using, routes both streams through it and
unloads it again after the call. No user configuration needed; it can be
switched off with pulse.filter-apply = false.

Upstream MR: <link to the GitLab MR>  (Closes #4170)
Backport for the 1.4 series in Trixie: <link to the 1.4 MR / patch>

I tested it headless with WirePlumber 0.5.8 (the Trixie version) on both
PipeWire master and 1.4: auto-load, routing, moving to another device, device
removal, unload after the call, and headsets with built-in echo cancellation
are left alone.

Could someone with a Librem 5 or PinePhone on Mobian Trixie try the 1.4
backport (I can provide a patched pipewire source package or a build recipe)
and confirm calls no longer echo? Happy to coordinate whatever testing you
need. Once it's merged upstream I'll submit the expense on the Open Collective
project for the bounty payout.

Thanks!
woahwhattheheck
```

## Remaining items (for the submitter, after opening the MR)

- Respond to maintainer review on the MR (Wim Taymans usually reviews pulse-server changes) and keep the 1.4 backport in sync.
- Hardware confirmation on a Librem 5 or PinePhone under Mobian Trixie, coordinated with DEPHCOM per the payout condition. Build Mobian's `pipewire` source package with `fix-1.4-backport.patch` added to `debian/patches`.
