## yzzx-iot

This repository enables real-time data collection from diverse IoT devices in the "yzzx" environment using Azure IoT Edge. The data is sent to Azure IoT Hub and then ingested into Azure Digital Twins (ADT) for digital modeling and analytics.

**Project structure:**

- `modules/`: Contains Azure IoT Edge modules for connecting to different IoT devices and protocols.
- `functions/`: Contains Azure Function code that processes incoming IoT Hub data and populates or updates Azure Digital Twins.
- `infra/`: Terraform code for provisioning Azure resources (IoT Hub, Digital Twins, Function Apps, etc.).
- Automation scripts for infrastructure deployment and device onboarding.

**Data flow:**
1. IoT devices send data to an Azure IoT Edge device running custom modules (see `modules/`).
2. The IoT Edge device forwards data to Azure IoT Hub.
3. Azure Functions (see `functions/`) process incoming messages and update Azure Digital Twins.

This project is designed for rapid prototyping and management of IoT solutions using Azure cloud and edge technologies.
