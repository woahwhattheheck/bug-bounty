# Mirrors the exports in _scripts/common.just for Linux x86_64, except OpenCV:
# vcpkg's source downloads are not reachable from this container, so OpenCV 4.12.0
# is built from the official git tag (shared libs, modules used by gyroflow-core)
# and linked through build.rs's non-vcpkg (dynamic) branch.
P=/home/user/work/clones/gyroflow__gyroflow
export QMAKE=$P/ext/6.4.3/gcc_64/bin/qmake
export FFMPEG_DIR=$P/ext/ffmpeg-9.0-linux-clang-gpl-lite
export FFMPEG_ARCH=amd64
export OPENCV_LINK_LIBS=opencv_core,opencv_calib3d,opencv_features2d,opencv_imgproc,opencv_video,opencv_flann,opencv_imgcodecs
export OPENCV_LINK_PATHS=$P/ext/opencv-4.12.0/lib
export OPENCV_INCLUDE_PATHS=$P/ext/opencv-4.12.0/include/opencv4
export LIBCLANG_PATH=/usr/lib/llvm-18/lib
export LD_LIBRARY_PATH=$P/target/release:$P/ext/6.4.3/gcc_64/lib:$FFMPEG_DIR/lib:$FFMPEG_DIR/lib/amd64:$P/ext/opencv-4.12.0/lib
export PATH=$P/ext/6.4.3/gcc_64/bin:$FFMPEG_DIR/bin:$FFMPEG_DIR/bin/amd64:$PATH
export LANG=C.UTF-8 LC_ALL=C.UTF-8
# qml-video-rs build.rs: same mdk-sdk-linux.tar.xz URL it would fetch, pre-downloaded with curl (7z not installed).
export MDK_SDK=$P/ext/mdk-sdk
export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:$MDK_SDK/lib/amd64
# libOpenCL.so dev symlink (ocl-icd-opencl-dev is not installed): ext/opencv-4.12.0/lib/libOpenCL.so -> /usr/lib/x86_64-linux-gnu/libOpenCL.so.1
