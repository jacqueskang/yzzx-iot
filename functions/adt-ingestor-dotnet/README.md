# adt-ingestor-dotnet

Azure Function (C#) triggered by IoT Hub's built-in Event Hub endpoint.

## Project Structure
- `adt-ingestor-dotnet.csproj`: Project file
- `host.json`: Azure Functions host config
- `local.settings.json`: Local dev settings
- `Functions/IoTHubEventHandler.cs`: Event Hub triggered function stub

## Usage
- Replace `<event-hub-name>` and `EventHubConnectionAppSetting` in `IoTHubEventHandler.cs` with your actual Event Hub name and connection setting.
- Build and deploy as a .NET Azure Function App.
