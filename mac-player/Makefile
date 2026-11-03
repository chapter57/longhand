# Builds "Mp3 Player.app" with the command-line tools; no Xcode project needed.
#
#   make              build it (into the build folder)
#   make run          build and open it
#   make install      put it in /Applications (replacing any older copy,
#                     including the old CapsulePlayer.app)
#
# On a PowerPC Mac running Leopard, or to build for one, you can name the
# architecture, e.g.:  make ARCHFLAGS="-arch ppc"

NAME     = Mp3 Player
EXEC     = Mp3Player
APP      = build/$(NAME).app
BIN      = build/$(EXEC)
STAMP    = build/.app-built
ICON     = icon/AppIcon.icns
DEST     ?= /Applications
SOURCES  = src/main.m src/AppController.m src/AudioEngine.m src/Library.m \
           src/TagReader.m src/TrackLoader.m src/VolumeHelper.m
HEADERS  = src/AppController.h src/AudioEngine.h src/Library.h \
           src/TagReader.h src/TrackLoader.h src/VolumeHelper.h

CC       ?= cc
ARCHFLAGS ?=
CFLAGS   = -O2 -Wall -Wno-deprecated-declarations $(ARCHFLAGS)
LIBS     = -framework Cocoa -framework AudioToolbox

# Tells macOS to re-read an app's name and icon. It moved between versions.
LSREGISTER_PATHS = \
  /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
  /System/Library/Frameworks/ApplicationServices.framework/Frameworks/LaunchServices.framework/Support/lsregister

all: $(STAMP)

# Compile into build/ first (make can't track paths with spaces in them).
$(BIN): $(SOURCES) $(HEADERS)
	mkdir -p build
	$(CC) $(CFLAGS) $(SOURCES) -o $(BIN) $(LIBS)

# Assemble the app: the program, its Info.plist and its icon.
$(STAMP): $(BIN) Info.plist $(ICON)
	rm -rf "$(APP)"
	mkdir -p "$(APP)/Contents/MacOS" "$(APP)/Contents/Resources"
	cp $(BIN) "$(APP)/Contents/MacOS/$(EXEC)"
	cp Info.plist "$(APP)/Contents/Info.plist"
	cp $(ICON) "$(APP)/Contents/Resources/AppIcon.icns"
	touch "$(APP)" $(STAMP)
	@echo "Built $(APP)"

run: all
	open "$(APP)"

install: all
	rm -rf "$(DEST)/$(NAME).app" "$(DEST)/CapsulePlayer.app"
	cp -R "$(APP)" "$(DEST)/"
	touch "$(DEST)/$(NAME).app"
	@for ls in $(LSREGISTER_PATHS); do \
	  if [ -x "$$ls" ]; then "$$ls" -f "$(DEST)/$(NAME).app"; break; fi; \
	done
	@echo "Installed $(DEST)/$(NAME).app"

# Rebuild the .icns after editing icon/icon-1024.png (needs: pip3 install pillow).
icon:
	python3 icon/make_icns.py icon/icon-1024.png $(ICON)

clean:
	rm -rf build CapsulePlayer.app

.PHONY: all run install clean icon
