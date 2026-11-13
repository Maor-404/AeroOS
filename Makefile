.PHONY: all hub webapp browser clean

all: hub webapp

hub:
	go build -ldflags="-s -w" -o aero-hub ./src/aero-hub

webapp:
	rustc -O src/aero-webapp/main.rs -o aero-webapp

browser:
	g++ -O2 -std=c++17 -fPIC src/aero-browser/main.cpp -o aero-browser \
		$$(pkg-config --cflags --libs Qt5Widgets Qt5WebEngineWidgets)

clean:
	rm -f aero-hub aero-webapp aero-browser
