resource "azurerm_linux_function_app" "main" {
  name                        = "func-${var.suffix}"
  location                    = azurerm_resource_group.main.location
  resource_group_name         = azurerm_resource_group.main.name
  service_plan_id             = azurerm_service_plan.main.id
  storage_account_name        = azurerm_storage_account.main.name
  storage_account_access_key  = azurerm_storage_account.main.primary_access_key
  functions_extension_version = "~4"

  identity {
    type = "SystemAssigned"
  }


  site_config {
    application_stack {
      node_version = "22"
    }
    minimum_tls_version = "1.2"
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME           = "node"
    WEBSITE_RUN_FROM_PACKAGE           = "1"
    ADT_URL                            = "https://${azurerm_digital_twins_instance.main.host_name}"
    AzureWebJobsStorage__accountName   = azurerm_storage_account.main.name
  }

  tags = var.tags
}
