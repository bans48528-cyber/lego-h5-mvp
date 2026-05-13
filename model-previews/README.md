Put preview images for built-in models in this folder.

Recommended flow:

1. Add a model file under `models/`, such as `models/my-model.mpd`.
2. Add a preview image here, such as `model-previews/my-model.jpg`.
3. Add an item to `MODEL_CATALOG` in `index.html`.

Each catalog item can use:

```js
{
  name: "My Model",
  file: "models/my-model.mpd",
  preview: "model-previews/my-model.jpg",
  category: "网站自带模型"
}
```
