# IMMARKUS Publisher

A CLI script for converting an IMMARKUS work folder into a web-publishable IIIF collection.

## Run

- `npm install`
- `npm start` - uses `config.yaml` in this folder
- `npm start path/to/config.yaml`

## Testing a generated manifest

- Edit `config.yaml` and set the base URL to `http://localhost:8080`
- Build the project with `npm start`
- Run `npx serve dist/`

