all: clean build archive

build: 
	docker pull galacticfog/dotnet-build:1.0.1 
	docker run --rm -v "${PWD}":/hello_world -w /hello_world galacticfog/dotnet-build:1.0.1 /bin/bash -c "dotnet restore && dotnet publish -o publish -c release -r debian.8-x64"

clean: 
	rm -rf publish obj bin

archive: 
	rm -f hello_world.zip 
	zip -r hello_world.zip publish
