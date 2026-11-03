# Builds CapsulePlayer.app with the command-line tools; no Xcode project needed.
#
#   make              build for this Mac
#   make run          build and open it
#   make install      copy it into /Applications
#
# On a PowerPC Mac running Leopard, or to build for one, you can name the
# architecture, e.g.:  make ARCHFLAGS="-arch ppc"

APP      = CapsulePlayer.app
BIN      = $(APP)/Contents/MacOS/CapsulePlayer
SOURCES  = src/main.m src/AppController.m src/AudioEngine.m src/Library.m \
           src/TagReader.m src/TrackLoader.m src/VolumeHelper.m
HEADERS  = src/AppController.h src/AudioEngine.h src/Library.h \
           src/TagReader.h src/TrackLoader.h src/VolumeHelper.h

CC       ?= cc
ARCHFLAGS ?=
CFLAGS   = -O2 -Wall -Wno-deprecated-declarations $(ARCHFLAGS)
LIBS     = -framework Cocoa -framework AudioToolbox

all: $(APP)

$(APP): $(BIN) Info.plist
	cp Info.plist $(APP)/Contents/Info.plist
	touch $(APP)

$(BIN): $(SOURCES) $(HEADERS)
	mkdir -p $(APP)/Contents/MacOS $(APP)/Contents/Resources
	$(CC) $(CFLAGS) $(SOURCES) -o $(BIN) $(LIBS)

run: all
	open $(APP)

install: all
	rm -rf /Applications/$(APP)
	cp -R $(APP) /Applications/

clean:
	rm -rf $(APP)

.PHONY: all run install clean
