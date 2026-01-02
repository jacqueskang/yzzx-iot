resource "azurerm_static_web_app" "main" {
  name                = "stapp-${var.suffix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku_tier            = "Free"
  tags                = var.tags

  # Enable system-assigned managed identity
  identity {
    type = "SystemAssigned"
  }

  # Optionally, set repository_url and branch if using GitHub Actions CI/CD
  # repository_url      = "https://github.com/<your-org>/<your-repo>"
  # branch              = "main"
  # build_properties {}
}
