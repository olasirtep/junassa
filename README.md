# Junassa Web Application
This is a web application designed to show realtime data about any commuter or long-distance train in Finland (also some trains from/to Russia). It was the technical part of thesis work for my bachelor's. The actual thesis can be found at: http://urn.fi/URN:NBN:fi:amk-2018121721900

## Technical requirements
The application runs on top of Apache2 web server and uses MySQL databases. The server-side of the application is written with PHP and Python, where Python fetches the data from Digitraffic API and PHP serves it to the client-side.

## Where the realtime data is from?
The realtime data about train traffic in Finland is open data produced by the Finnish Transport Agency and is freely available at https://rata.digitraffic.fi/.
