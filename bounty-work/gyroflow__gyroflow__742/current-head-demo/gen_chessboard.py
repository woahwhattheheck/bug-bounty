#!/usr/bin/env python3
"""Render a generated chessboard calibration clip (input data only).

Plain chessboard: 15x9 squares -> 14x8 inner corners (Gyroflow calibrator default
grid), viewed by a camera with OpenCV fisheye-model distortion, moving through
varied poses. Writes raw RGB frames to stdout for ffmpeg.
"""
import math
import sys

import numpy as np

W, H = 1280, 720
SS = 2                      # supersampling factor per axis
FPS = 30
SECONDS = 10
FX = FY = 620.0
CX, CY = W / 2.0, H / 2.0
K = (0.06, 0.012, -0.004, 0.0008)   # fisheye k1..k4
SQ_X, SQ_Y = 15, 9                  # squares
MARGIN = 1.0                        # white border, in squares


def undistorted_rays():
    ys, xs = np.mgrid[0:H * SS, 0:W * SS].astype(np.float32)
    u = (xs + 0.5) / SS - 0.5
    v = (ys + 0.5) / SS - 0.5
    xd = (u - CX) / FX
    yd = (v - CY) / FY
    rd = np.sqrt(xd * xd + yd * yd)
    theta = rd.copy()
    for _ in range(12):  # Newton: theta*(1+k1 t^2+...) = rd
        t2 = theta * theta
        f = theta * (1 + K[0] * t2 + K[1] * t2 ** 2 + K[2] * t2 ** 3 + K[3] * t2 ** 4) - rd
        df = 1 + 3 * K[0] * t2 + 5 * K[1] * t2 ** 2 + 7 * K[2] * t2 ** 3 + 9 * K[3] * t2 ** 4
        theta = theta - f / df
    r = np.tan(theta)
    scale = np.where(rd > 1e-9, r / np.maximum(rd, 1e-9), 1.0).astype(np.float32)
    return np.stack([xd * scale, yd * scale, np.ones_like(xd)], axis=-1)


def rot(rx, ry, rz):
    cx, sx = math.cos(rx), math.sin(rx)
    cy, sy = math.cos(ry), math.sin(ry)
    cz, sz = math.cos(rz), math.sin(rz)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def pose(t):
    # Smooth path covering centre, edges and corners with tilts.
    a = 2 * math.pi * t / SECONDS
    tx = 5.5 * math.sin(a * 1.0)
    ty = 2.6 * math.sin(a * 2.0 + 0.6)
    tz = 19.0 + 3.0 * math.sin(a * 1.5)
    rx = 0.38 * math.sin(a * 1.3 + 1.0)
    ry = 0.42 * math.sin(a * 0.9 + 2.0)
    rz = 0.15 * math.sin(a * 0.7)
    return rot(rx, ry, rz), np.array([tx, ty, tz])


def render(rays, R, T):
    # Board plane: origin at board centre, axes R[:,0], R[:,1]; normal R[:,2].
    n = R[:, 2]
    denom = rays @ n.astype(np.float32)
    s = float(n @ T) / np.where(np.abs(denom) > 1e-6, denom, 1e-6)
    P = rays * s[..., None] - T.astype(np.float32)
    bu = P @ R[:, 0].astype(np.float32) + SQ_X / 2.0
    bv = P @ R[:, 1].astype(np.float32) + SQ_Y / 2.0
    inside_board = (bu >= -MARGIN) & (bu < SQ_X + MARGIN) & (bv >= -MARGIN) & (bv < SQ_Y + MARGIN) & (s > 0)
    inside_grid = (bu >= 0) & (bu < SQ_X) & (bv >= 0) & (bv < SQ_Y)
    checker = ((np.floor(bu).astype(np.int32) + np.floor(bv).astype(np.int32)) & 1) == 0
    img = np.full(bu.shape, 110.0, np.float32)            # grey background
    img[inside_board] = 235.0                             # white border
    img[inside_board & inside_grid & checker] = 25.0      # black squares
    img = img.reshape(H, SS, W, SS).mean(axis=(1, 3))
    return img


def corners_in_view(R, T):
    pts = []
    for x in (-MARGIN, SQ_X + MARGIN):
        for y in (-MARGIN, SQ_Y + MARGIN):
            p = R @ np.array([x - SQ_X / 2.0, y - SQ_Y / 2.0, 0.0]) + T
            r = math.hypot(p[0], p[1]) / p[2]
            th = math.atan(r)
            thd = th * (1 + K[0] * th ** 2 + K[1] * th ** 4 + K[2] * th ** 6 + K[3] * th ** 8)
            sc = thd / r if r > 1e-9 else 1.0
            pts.append((FX * p[0] / p[2] * sc + CX, FY * p[1] / p[2] * sc + CY))
    return all(8 <= u <= W - 8 and 8 <= v <= H - 8 for u, v in pts)


def main():
    rays = undistorted_rays()
    out = sys.stdout.buffer
    bad = 0
    for i in range(FPS * SECONDS):
        R, T = pose(i / FPS)
        if not corners_in_view(R, T):
            bad += 1
        g = np.clip(render(rays, R, T), 0, 255).astype(np.uint8)
        out.write(np.repeat(g[..., None], 3, axis=2).tobytes())
    print(f"frames={FPS * SECONDS} board_partially_out_of_view={bad}", file=sys.stderr)


if __name__ == "__main__":
    main()
