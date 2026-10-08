# Writes a scene collection with scene folders for the end-to-end check.
import json, sys, uuid
out = sys.argv[1]
with_folders_key = sys.argv[2] == "with-folders-key"
scenes = [
    ("Starting Soon", None),
    ("Game", "Gameplay"),
    ("Game + Cam", "Gameplay"),
    ("BRB", None),
    ("Webcam Frame", "Components"),
    ("Alerts", "Components"),
    ("Ending", None),
]
def scene(name, folder):
    priv = {}
    if folder:
        priv["scene_folder"] = folder
    if name == "Alerts":
        priv["show_in_multiview"] = False
    return {"id": "scene", "versioned_id": "scene", "name": name, "uuid": str(uuid.uuid5(uuid.NAMESPACE_DNS, name)),
            "settings": {"id_counter": 0, "custom_size": False, "items": []}, "private_settings": priv,
            "mixers": 0, "sync": 0, "flags": 0, "volume": 1.0, "balance": 0.5, "enabled": True, "muted": False}
data = {
    "name": "Folders Test",
    "current_scene": "Game",
    "current_program_scene": "Game",
    "scene_order": [{"name": n} for n, _ in scenes],
    "sources": [scene(n, f) for n, f in scenes],
    "groups": [],
    "transitions": [],
    "current_transition": "Fade",
    "transition_duration": 300,
}
if with_folders_key:
    data["scene_folders"] = [
        {"name": "Gameplay", "collapsed": False, "position": 1},
        {"name": "Empty Folder", "collapsed": False, "position": 3},
        {"name": "Components", "collapsed": True, "position": 4},
    ]
json.dump(data, open(out, "w"), indent=4)
