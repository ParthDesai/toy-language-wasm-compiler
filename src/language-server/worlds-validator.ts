import { ValidationAcceptor, ValidationChecks } from 'langium';
import { WorldsAstType, Main } from './generated/ast';
import type { WorldsServices } from './worlds-module';

/**
 * Register custom validation checks.
 */
export function registerValidationChecks(services: WorldsServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.WorldsValidator;
    const checks: ValidationChecks<WorldsAstType> = {
        Main: validator.checkWorld,
    };
    registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 */
export class WorldsValidator {
    checkWorld(main: Main, accept: ValidationAcceptor): void {
        const animals = new Set();
        main.animals.forEach(animal => {
            if (animals.has(animal.name)) {
                accept('error', 'Animal have duplicate name', {node: animal, property: 'name'});
            }
            animals.add(animal.name);
        });

        const instances = new Set();
        main.instances.forEach(instance => {
            if (instances.has(instance.name)) {
                accept('error', 'Instance have duplicate name', {node: instance, property: 'name'});
            }
            if (!animals.has(instance.species.ref?.name)) {
                accept('error', 'Instance have unknown animal species', {node: instance, property: 'species'});
            }
            instances.add(instance.name);
        });

        const worlds = new Set();
        const seenInstances = new Set();
        main.worlds.forEach(world => {
            if (worlds.has(world.name)) {
                accept('error', 'World have duplicate name', {node: world, property: 'name'});
            }
            world.contains.forEach(containedInstance => {
                if (!instances.has(containedInstance.ref?.name)) {
                    accept('error', 'World have unknown animal instance', {node: world, property: 'contains'});
                }
                if (seenInstances.has(containedInstance.ref?.name)) {
                    accept('error', 'World have duplicate animal instance', {node: world, property: 'contains'});
                }
                seenInstances.add(containedInstance.ref?.name);
            });
        });
    }
}
