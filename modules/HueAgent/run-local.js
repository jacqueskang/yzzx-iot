#!/usr/bin/env node

const logger = require('./logger');
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
  } catch {
    return null;
  }
}

function createModule() {
  logger.logInfo(`Creating module ${MODULE_ID}...`);
  try {
    execSync(
      `az iot hub module-identity create --hub-name ${HUB_NAME} --device-id ${DEVICE_ID} --module-id ${MODULE_ID}`,
      { encoding: 'utf-8', stdio: 'inherit' }
    );
    logger.logInfo('Module created successfully\n');
  } catch (error) {
    console.error('Failed to create module:', error.message);
    throw error;
  }
}

logger.logInfo('Fetching module connection string...');
try {
  let connectionString = getConnectionString();

  if (!connectionString) {
    logger.logInfo(`Module ${MODULE_ID} not found.`);
    createModule();
    connectionString = getConnectionString();
  }

  if (!connectionString) {
    logger.logError('Failed to retrieve connection string after module creation');
    process.exit(1);
  }

  logger.logInfo('Starting HueAgent locally...\n');
  process.env.EdgeHubConnectionString = connectionString;

  require('./app.js');
} catch (error) {
  logger.logError('Error:', error.message);
  logger.logError('\nMake sure:');
  logger.logError('1. Azure CLI is installed and logged in (az login)');
  logger.logError('2. IoT extension is installed (az extension add --name azure-iot)');
  logger.logError(`3. Device ${DEVICE_ID} exists in hub ${HUB_NAME}`);
  process.exit(1);
}
