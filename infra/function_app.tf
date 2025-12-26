resource "azurerm_function_app_flex_consumption" "main" {
  name                = "func-${var.suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  service_plan_id     = azurerm_service_plan.main.id

  storage_container_type      = "blobContainer"
  storage_container_endpoint  = "${azurerm_storage_account.main.primary_blob_endpoint}${azurerm_storage_container.function.name}"
  storage_authentication_type = "SystemAssignedIdentity"

  runtime_name    = "node"
  runtime_version = "22"

  maximum_instance_count = 40
  instance_memory_in_mb  = 512

  app_settings = {
    WEBSITE_RUN_FROM_PACKAGE = "1"
    ADT_URL                  = "https://${azurerm_digital_twins_instance.main.host_name}"
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
}
