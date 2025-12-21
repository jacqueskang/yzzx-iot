#!/usr/bin/env node
const { execSync } = require('child_process');

const HUB_NAME = 'iot-jkang-sbx';
const DEVICE_ID = 'pi4b';
const MODULE_ID = 'HueAgent';

function getConnectionString() {
  try {
    const connectionString = execSync(
      `az iot hub module-identity connection-string show --hub-name ${HUB_NAME} --device-id ${DEVICE_ID} --module-id ${MODULE_ID} --output tsv`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    return connectionString;
  } catch (error) {
    return null;
  }
}

function createModule() {
  console.log(`Creating module ${MODULE_ID}...`);
  try {
    execSync(
      `az iot hub module-identity create --hub-name ${HUB_NAME} --device-id ${DEVICE_ID} --module-id ${MODULE_ID}`,
      { encoding: 'utf-8', stdio: 'inherit' }
    );
    console.log('Module created successfully\n');
  } catch (error) {
    console.error('Failed to create module:', error.message);
    throw error;
  }
}

console.log('Fetching module connection string...');
try {
  let connectionString = getConnectionString();

  if (!connectionString) {
    console.log(`Module ${MODULE_ID} not found.`);
    createModule();
    connectionString = getConnectionString();
  }

  if (!connectionString) {
    console.error('Failed to retrieve connection string after module creation');
    process.exit(1);
  }

  console.log('Starting HueAgent locally...\n');
  process.env.EdgeHubConnectionString = connectionString;
  
  require('./app.js');
} catch (error) {
  console.error('Error:', error.message);
  console.error('\nMake sure:');
  console.error('1. Azure CLI is installed and logged in (az login)');
  console.error('2. IoT extension is installed (az extension add --name azure-iot)');
  console.error(`3. Device ${DEVICE_ID} exists in hub ${HUB_NAME}`);
  process.exit(1);
}
