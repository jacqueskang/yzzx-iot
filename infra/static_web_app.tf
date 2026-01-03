resource "azurerm_static_web_app" "main" {
  name                = "stapp-${var.suffix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku_tier            = "Free"
  tags                = var.tags

  app_settings = {
    AZURE_CLIENT_ID     = var.static_web_app_client_id
    AZURE_CLIENT_SECRET = var.static_web_app_client_secret
  }
}
