"use strict";

const { Message } = require("azure-iot-device");

class Filter {
  constructor(threshold) {
    this.temperatureThreshold = threshold;
  }

  filterMessage(message) {
    const messageBytes = message.getBytes();
    const messageStr = messageBytes.toString("utf8");

    const messageObject = JSON.parse(messageStr);
    if (messageObject && messageObject.machine && messageObject.machine.temperature < this.temperatureThreshold) {
      return null;
    }

    const filteredMessage = new Message(messageBytes);
    filteredMessage.contentType = message.contentType || "application/json";
    filteredMessage.contentEncoding = message.contentEncoding || "utf-8";

    message.properties.propertyList.forEach((prop) => {
      filteredMessage.properties.add(prop.key, prop.value);
    });

    filteredMessage.properties.add("MessageType", "Alert");
    filteredMessage.properties.add("ProcessedBy", "HueAgent");
    return filteredMessage;
  }

  setThreshold(value) {
    this.temperatureThreshold = value;
  }
}

module.exports = Filter;
