# Mirrors _scripts/common.just exports for Linux x86_64, with OpenCV built
# from the official 4.12.0 tag as shared libs (same approach as the earlier
# demo; vcpkg source downloads are not used).
P=${GYRO_DIR:?set GYRO_DIR to the gyroflow clone}
export QMAKE=$P/ext/6.4.3/gcc_64/bin/qmake
export FFMPEG_DIR=$P/ext/ffmpeg-9.0-linux-clang-gpl-lite
export FFMPEG_ARCH=amd64
export OPENCV_LINK_LIBS=opencv_core,opencv_calib3d,opencv_features2d,opencv_imgproc,opencv_video,opencv_flann,opencv_imgcodecs
export OPENCV_LINK_PATHS=$P/ext/opencv-4.12.0/lib
export OPENCV_INCLUDE_PATHS=$P/ext/opencv-4.12.0/include/opencv4
export LIBCLANG_PATH=${LIBCLANG_PATH:-$(ls -d /usr/lib/llvm-*/lib 2>/dev/null | sort -V | tail -1)}
export LD_LIBRARY_PATH=$P/target/deploy:$P/target/release:$P/ext/6.4.3/gcc_64/lib:$FFMPEG_DIR/lib:$FFMPEG_DIR/lib/amd64:$P/ext/opencv-4.12.0/lib
export PATH=$P/ext/6.4.3/gcc_64/bin:$FFMPEG_DIR/bin:$FFMPEG_DIR/bin/amd64:$PATH
export LANG=C.UTF-8 LC_ALL=C.UTF-8
# qml-video-rs build.rs uses MDK_SDK when set (same tarball it would download).
export MDK_SDK=$P/ext/mdk-sdk
export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:$MDK_SDK/lib/amd64
