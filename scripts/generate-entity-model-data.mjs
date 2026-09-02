import fs from 'node:fs'

const [modelsPath, geometryPath, outputPath] = process.argv.slice(2)
if (!modelsPath || !geometryPath || !outputPath) {
	throw new Error('Usage: node scripts/generate-entity-model-data.mjs <entity_models.json> <entity_geometry.json> <output.json>')
}

const modelDocument = JSON.parse(fs.readFileSync(modelsPath, 'utf8'))
const geometryDocument = JSON.parse(fs.readFileSync(geometryPath, 'utf8'))
const referenced = new Set()
Object.values(modelDocument.models).forEach(model => {
	Object.values(model.axes ?? {}).forEach(axis => {
		Object.values(axis.options ?? {}).forEach(option => {
			if (option.geometry) referenced.add(option.geometry)
		})
	})
})
const geometries = Object.fromEntries([...referenced]
	.filter(key => geometryDocument.geometries[key])
	.map(key => [key, geometryDocument.geometries[key]]))
const output = {
	source_version: modelDocument.source_version,
	models: modelDocument.models,
	geometries,
}
fs.writeFileSync(outputPath, JSON.stringify(output))
