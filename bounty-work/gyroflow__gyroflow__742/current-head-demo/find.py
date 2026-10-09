#!/usr/bin/env python3
"""find.py <screenshot.png> <template.png> <x0> <y0> <x1> <y1>
Print "cx cy score" for the best match of template inside the region (grayscale SSD).
Used only to locate a list row on screen after scrolling; does not alter anything."""
import sys

import numpy as np
from PIL import Image

shot, tpl = sys.argv[1], sys.argv[2]
x0, y0, x1, y1 = map(int, sys.argv[3:7])
img = np.asarray(Image.open(shot).convert("L"), dtype=np.float32)[y0:y1, x0:x1]
t = np.asarray(Image.open(tpl).convert("L"), dtype=np.float32)
th, tw = t.shape
best = (1e18, 0, 0)
for y in range(0, img.shape[0] - th + 1):
    row = img[y:y + th]
    win = np.lib.stride_tricks.sliding_window_view(row, (th, tw))[0]
    ssd = ((win - t) ** 2).mean(axis=(1, 2))
    i = int(ssd.argmin())
    if ssd[i] < best[0]:
        best = (float(ssd[i]), i, y)
score, bx, by = best
print(x0 + bx + tw // 2, y0 + by + th // 2, round(score, 1))
