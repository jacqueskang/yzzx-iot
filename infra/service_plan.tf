resource "azurerm_service_plan" "main" {
  name                = "plan-${var.suffix}"
    location            = var.location
    resource_group_name = azurerm_resource_group.main.name
    os_type             = "Linux"
    sku_name            = "Y1"
    tags                = var.tags
}
