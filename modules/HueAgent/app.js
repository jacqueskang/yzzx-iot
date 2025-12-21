"use strict";

const { ModuleClient, Message } = require("azure-iot-device");
const { Mqtt: Transport } = require("azure-iot-device-mqtt");
const Filter = require("./filter");

const HEARTBEAT_METHOD = "heartbeat";
const TEMP_THRESHOLD_KEY = "TemperatureThreshold";
const DEFAULT_THRESHOLD = 25;

let threshold = DEFAULT_THRESHOLD;
const filter = new Filter(threshold);

ModuleClient.fromEnvironment(Transport, (err, client) => {
  if (err) {
    throw err;
  }

  client.on("error", (clientError) => {
    console.error(`HueAgent client error: ${clientError}`);
  });

  client.open((openErr) => {
    if (openErr) {
      throw openErr;
    }

    console.log("HueAgent module client initialized");

    client.on("inputMessage", (inputName, msg) => {
      handleIncomingMessage(client, inputName, msg);
    });

    client.getTwin((twinErr, twin) => parseTwin(twinErr, twin, client));

    client.onMethod(HEARTBEAT_METHOD, (request, response) => {
      console.log(`Received direct method: ${HEARTBEAT_METHOD}`);
      const payload = request && request.payload ? request.payload : {};
      if (Object.keys(payload).length) {
        console.dir(payload);
      }

      const messageStr = "Module [HueAgent] is running";
      const heartbeatMessage = new Message(messageStr);

      client.sendOutputEvent(
        HEARTBEAT_METHOD,
        heartbeatMessage,
        printResultFor(`Sent method response via event [${HEARTBEAT_METHOD}]`)
      );

      response.send(200, null, (methodErr) => {
        if (methodErr) {
          console.error(`Failed sending method response: ${methodErr}`);
        } else {
          console.log("Successfully sent method response");
        }
      });
    });
  });
});

function parseTwin(err, twin, client) {
  if (err) {
    console.error(`Could not get twin: ${err.message}`);
    return;
  }

  threshold = twin.properties.desired[TEMP_THRESHOLD_KEY] || threshold;
  filter.setThreshold(threshold);
  console.log(`Initial temperature threshold set to ${threshold}`);

  twin.on("properties.desired", (desiredProps) => {
    if (desiredProps[TEMP_THRESHOLD_KEY] !== undefined) {
      threshold = desiredProps[TEMP_THRESHOLD_KEY];
      filter.setThreshold(threshold);
      console.log(`Temperature threshold updated to ${threshold}`);
    }
  });

  twin.properties.reported.update({ [TEMP_THRESHOLD_KEY]: threshold }, (reportErr) => {
    if (reportErr) {
      console.error(`Failed to report properties: ${reportErr}`);
    }
  });
}

function handleIncomingMessage(client, inputName, message) {
  client.complete(message, printResultFor("Receiving message"));

  if (!message) {
    return;
  }

  try {
    const filteredMessage = filter.filterMessage(message);
    if (!filteredMessage) {
      return; // dropped because below threshold
    }

    client.sendOutputEvent(
      "output1",
      filteredMessage,
      printResultFor(`Sending filtered message from ${inputName}`)
    );
  } catch (messageErr) {
    console.error(`Error when filtering message, skipping: ${messageErr}`);
  }
}

function printResultFor(op) {
  return function printResult(err, res) {
    if (err) {
      console.error(`${op} error: ${err.toString()}`);
    }
    if (res) {
      console.log(`${op} status: ${res.constructor.name}`);
    }
  };
}
