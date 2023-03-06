"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorldsValidator = exports.registerValidationChecks = void 0;
/**
 * Register custom validation checks.
 */
function registerValidationChecks(services) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.WorldsValidator;
    const checks = {
        Main: validator.checkWorld,
    };
    registry.register(checks, validator);
}
exports.registerValidationChecks = registerValidationChecks;
/**
 * Implementation of custom validations.
 */
class WorldsValidator {
    checkWorld(main, accept) {
        const animals = new Set();
        main.animals.forEach(animal => {
            if (animals.has(animal.name)) {
                accept('error', 'Animal have duplicate name', { node: animal, property: 'name' });
            }
            animals.add(animal.name);
        });
        const instances = new Set();
        main.instances.forEach(instance => {
            var _a;
            if (instances.has(instance.name)) {
                accept('error', 'Instance have duplicate name', { node: instance, property: 'name' });
            }
            if (!animals.has((_a = instance.species.ref) === null || _a === void 0 ? void 0 : _a.name)) {
                accept('error', 'Instance have unknown animal species', { node: instance, property: 'species' });
            }
            instances.add(instance.name);
        });
        const worlds = new Set();
        const seenInstances = new Set();
        main.worlds.forEach(world => {
            if (worlds.has(world.name)) {
                accept('error', 'World have duplicate name', { node: world, property: 'name' });
            }
            world.contains.forEach(containedInstance => {
                var _a, _b, _c;
                if (!instances.has((_a = containedInstance.ref) === null || _a === void 0 ? void 0 : _a.name)) {
                    accept('error', 'World have unknown animal instance', { node: world, property: 'contains' });
                }
                if (seenInstances.has((_b = containedInstance.ref) === null || _b === void 0 ? void 0 : _b.name)) {
                    accept('error', 'World have duplicate animal instance', { node: world, property: 'contains' });
                }
                seenInstances.add((_c = containedInstance.ref) === null || _c === void 0 ? void 0 : _c.name);
            });
        });
    }
}
exports.WorldsValidator = WorldsValidator;
//# sourceMappingURL=worlds-validator.js.map