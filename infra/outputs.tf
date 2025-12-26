output "iothub_name" {
  value       = azurerm_iothub.main.name
  description = "IoT Hub name"
}
output "resource_group_name" {
  value       = azurerm_resource_group.main.name
  description = "Resource group used for deployment"
}

output "adt_host_name" {
  value       = azurerm_digital_twins_instance.main.host_name
  description = "FQDN for Azure Digital Twins endpoint"
}

output "function_app_name" {
  value       = azurerm_function_app_flex_consumption.main.name
  description = "Azure Function App name"
}
