resource "azurerm_iothub" "main" {
  name                = "iot-${var.suffix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  sku {
    name     = "F1"
    capacity = 1
  }

  tags = var.tags
  event_hub_partition_count = 2

  fallback_route {
    enabled        = true
    source         = "DeviceMessages"
    endpoint_names = ["events"]
    condition      = "true"
  }
}
