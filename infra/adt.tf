resource "azurerm_digital_twins_instance" "main" {
  name                = "adt-${var.suffix}"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = var.tags
}
