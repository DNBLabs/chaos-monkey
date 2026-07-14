output "resource_group_name" {
  description = "Resource group that the AKS cluster and ACR will be created in."
  value       = azurerm_resource_group.demo.name
}
