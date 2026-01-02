variable "suffix" {
  default = "yzzx-iot"
  type    = string
}

variable "location" {
  default = "westeurope"
  type    = string
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default = {
    stack = "yzzx-iot"
  }
}

variable "rooms" {
  description = "List of rooms to seed in Azure Digital Twins"
  type = list(object({
    id   = string
    name = string
  }))
  default = [
    { id = "room-bedroom", name = "卧室" },
    { id = "room-bathroom", name = "浴室" },
    { id = "room-wc", name = "厕所" },
    { id = "room-kitchen", name = "厨房" },
    { id = "room-office", name = "办公室" },
    { id = "room-guest-room", name = "客房" },
    { id = "room-entryway", name = "门厅" },
    { id = "room-living-room", name = "客厅" }
  ]
}
