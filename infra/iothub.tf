resource "azurerm_iothub" "main" {
  name                = "iot-${var.suffix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  sku {
    name     = "F1"
    capacity = 1
  }

  tags                         = var.tags
  event_hub_partition_count    = 2
  local_authentication_enabled = true

  fallback_route {
    enabled        = true
    source         = "DeviceMessages"
    endpoint_names = ["events"]
    condition      = "true"
  }
}

resource "azurerm_iothub_shared_access_policy" "eventhub_receiver" {
  name                = "functionapp-eventhub-receiver"
  resource_group_name = azurerm_iothub.main.resource_group_name
  iothub_name         = azurerm_iothub.main.name
  service_connect     = true
}

resource "azurerm_iothub_consumer_group" "func_ingress" {
  name                   = "func-ingress"
  iothub_name            = azurerm_iothub.main.name
  eventhub_endpoint_name = "events"
  resource_group_name    = azurerm_resource_group.main.name
}

