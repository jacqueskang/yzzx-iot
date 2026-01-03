resource "azurerm_static_web_app" "main" {
  name                = "stapp-${var.suffix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku_tier            = "Free"
  tags                = var.tags

  app_settings = {
    AZURE_TENANT_ID     = "d6bc13d4-9f71-4cce-a8cf-87039d919f0c"
    AZURE_CLIENT_ID     = var.static_web_app_client_id
    AZURE_CLIENT_SECRET = var.static_web_app_client_secret
    ADT_URL             = "https://${azurerm_digital_twins_instance.main.host_name}"
  }
}
