using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace AdtIngestorDotnet.Functions
{
    public class IoTHubEventHandler
    {
        private readonly ILogger _logger;

        public IoTHubEventHandler(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<IoTHubEventHandler>();
        }

        [Function("IoTHubEventHandler")]
        public void Run([
            EventHubTrigger(
                "%EVENTHUB_NAME%",
                Connection = "EVENTHUB_CONNECTION_STRING",
                ConsumerGroup = "%EVENTHUB_CONSUMER_GROUP%"
            )] string[] events)
        {
            _logger.LogInformation($"Received {events.Length} event(s) from IoT Hub.");
            // TODO: Add logic here
        }
    }
}
