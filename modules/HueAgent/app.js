"use strict";

const { ModuleClient, Message } = require("azure-iot-device");
const { Mqtt: Transport } = require("azure-iot-device-mqtt");

const HEARTBEAT_METHOD = "heartbeat";
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 5000;

function connectWithRetry(retryCount = 0) {
  ModuleClient.fromEnvironment(Transport, (err, client) => {
    if (err) {
      console.error(`Error creating client: ${err}`);
      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying connection in ${RETRY_DELAY_MS}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(() => connectWithRetry(retryCount + 1), RETRY_DELAY_MS);
      } else {
        console.error("Max retries reached. Exiting.");
        process.exit(1);
      }
      return;
    }

    client.on("error", (clientError) => {
      console.error(`HueAgent client error: ${clientError}`);
    });

    client.open((openErr) => {
      if (openErr) {
        console.error(`Error opening connection: ${openErr}`);
        if (retryCount < MAX_RETRIES) {
          console.log(`Retrying connection in ${RETRY_DELAY_MS}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          setTimeout(() => connectWithRetry(retryCount + 1), RETRY_DELAY_MS);
        } else {
          console.error("Max retries reached. Exiting.");
          process.exit(1);
        }
        return;
      }

      console.log("HueAgent module client initialized");

    client.on("inputMessage", (inputName, msg) => {
      handleIncomingMessage(client, inputName, msg);
    });

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
}

// Start connection with retry logic
connectWithRetry();

function handleIncomingMessage(client, inputName, message) {
  client.complete(message, printResultFor("Receiving message"));

  if (!message) {
    return;
  }

  try {
    client.sendOutputEvent(
      "output1",
      message,
      printResultFor(`Sending message from ${inputName}`)
    );
  } catch (messageErr) {
    console.error(`Error when processing message, skipping: ${messageErr}`);
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
