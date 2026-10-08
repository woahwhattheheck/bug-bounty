# Local-only helper for a plugin-less validation build (not part of the patch).
set_property(GLOBAL APPEND PROPERTY _OBS_EXECUTABLES libobs)
cmake_language(DEFER DIRECTORY "${CMAKE_SOURCE_DIR}" CALL set_obs_core_modules)
# Local-only: the frontend refuses to start without the rtmp-services module
include(compilerconfig)
include(defaults)
include(helpers)
add_subdirectory("${CMAKE_SOURCE_DIR}/plugins/rtmp-services" "${CMAKE_BINARY_DIR}/plugins/rtmp-services")
set_property(GLOBAL APPEND PROPERTY OBS_MODULES_ENABLED rtmp-services)
# Local-only: simple output mode needs an AAC (obs-ffmpeg) and H.264 (obs-x264) encoder to start
set(ENABLE_NEW_MPEGTS_OUTPUT OFF CACHE BOOL "" FORCE)
add_subdirectory("${CMAKE_SOURCE_DIR}/plugins/obs-ffmpeg" "${CMAKE_BINARY_DIR}/plugins/obs-ffmpeg")
add_subdirectory("${CMAKE_SOURCE_DIR}/plugins/obs-x264" "${CMAKE_BINARY_DIR}/plugins/obs-x264")
set_property(GLOBAL APPEND PROPERTY OBS_MODULES_ENABLED obs-ffmpeg obs-x264)
# Local-only: the frontend needs the default (Fade/Cut) transitions
add_subdirectory("${CMAKE_SOURCE_DIR}/plugins/obs-transitions" "${CMAKE_BINARY_DIR}/plugins/obs-transitions")
set_property(GLOBAL APPEND PROPERTY OBS_MODULES_ENABLED obs-transitions)
