resource "azurerm_function_app_flex_consumption" "main" {
  name                = "func-${var.suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  service_plan_id     = azurerm_service_plan.main.id

  storage_container_type      = "blobContainer"
  storage_container_endpoint  = "${azurerm_storage_account.main.primary_blob_endpoint}${azurerm_storage_container.function.name}"
  storage_authentication_type = "StorageAccountConnectionString"
  storage_access_key          = azurerm_storage_account.main.primary_access_key

  runtime_name    = "dotnet-isolated"
  runtime_version = "8.0"

  maximum_instance_count = 40
  instance_memory_in_mb  = 512

  app_settings = {
    ADT_URL                 = "https://${azurerm_digital_twins_instance.main.host_name}"
    EVENTHUB_NAME           = azurerm_iothub.main.event_hub_events_path
    EVENTHUB_CONSUMER_GROUP = azurerm_iothub_consumer_group.func_ingress.name
    EVENTHUB_CONNECTION_STRING = join("", [
      "Endpoint=", azurerm_iothub.main.event_hub_events_endpoint, ";",
      "SharedAccessKeyName=", azurerm_iothub_shared_access_policy.eventhub_receiver.name, ";",
      "SharedAccessKey=", azurerm_iothub_shared_access_policy.eventhub_receiver.primary_key, ";",
      "EntityPath=", azurerm_iothub.main.event_hub_events_path
    ])
  }

  site_config {
    minimum_tls_version = "1.2"

    application_insights_key               = azurerm_application_insights.main.instrumentation_key
    application_insights_connection_string = azurerm_application_insights.main.connection_string
  }

  identity {
    type = "SystemAssigned"
  }

  tags = var.tags

  lifecycle {
    ignore_changes = [
      tags["hidden-link:/app-insights-resource-id"]
    ]
  }
}
