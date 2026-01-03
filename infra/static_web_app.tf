resource "azurerm_static_web_app" "main" {
  name                = "stapp-${var.suffix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku_tier            = "Free"
  tags                = var.tags
}
