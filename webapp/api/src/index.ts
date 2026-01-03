import { app } from "@azure/functions";
import "./functions/getLights";
import "./functions/updateLightPosition";

app.setup({
  enableHttpStream: true,
});
