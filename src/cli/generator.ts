import fs from 'fs';
import { CompositeGeneratorNode, toString } from 'langium';
import path from 'path';
import { Main, Animal, Instance, World } from '../language-server/generated/ast';
import { extractDestinationAndName } from './cli-util';

function stringToBinary(str: string): {data: Uint8Array, length: number} {
    const data = new Uint8Array(str.split('').map(function (ch) {return ch.charCodeAt(0)}));
    return {data, length: data.length};
}

function animalToBinary(animal: Animal): {data: Uint8Array, length: number} {
    const serializedGenes = stringToBinary(animal.gene);
    const serializedAnimalName = stringToBinary(animal.name);
    const serializedAnimalSound = stringToBinary(animal.sound);

    const animalArray = new Uint8Array(3 + serializedGenes.length + serializedAnimalName.length + serializedAnimalSound.length);
    animalArray[0] = 3;
    animalArray.set(serializedGenes.data, animalArray[0]);

    animalArray[1] = animalArray[0] + serializedGenes.length;
    animalArray.set(serializedAnimalName.data, animalArray[1]);

    animalArray[2] = animalArray[1] + serializedAnimalName.length;
    animalArray.set(serializedAnimalSound.data, animalArray[2]);

    return {data: animalArray, length: animalArray.length};
}

function instanceToBinary(instance: Instance, animalTable: Map<string, number>): {data: Uint8Array, length: number} {
    const serializedName = stringToBinary(instance.name);
    if (instance.species.ref === undefined) {
        throw Error("Reference to species is undefined");
    }
    const speciesRef = animalTable.get(instance.species.ref?.name);
    if (speciesRef === undefined) {
        throw Error("Cannot find reference to species");
    }
    const serializedSpeciesRef = new Uint8Array(8);
    new DataView(serializedSpeciesRef.buffer).setUint32(0, speciesRef);

    const instanceArray = new Uint8Array(2 + serializedName.length + 8);
    instanceArray[0] = 2;
    instanceArray.set(serializedName.data, instanceArray[0]);

    instanceArray[1] = instanceArray[0] + serializedName.length;
    instanceArray.set(serializedSpeciesRef, instanceArray[1]);

    return {data: instanceArray, length: instanceArray.length};
}

function worldToBinary(world: World, instanceTable: Map<string, number>): {data: Uint8Array, length: number} {
    const serializedName = stringToBinary(world.name);

    const serializedContains = Array<Uint8Array>(world.contains.length);
    const worldArray = new Uint8Array(2 + serializedName.length + world.contains.length*8);

    worldArray[0] = 2;
    worldArray.set(serializedName, worldArray[0]);

    worldArray[1] = worldArray[0] + serializedName.length;
    world.contains.forEach((containedInstance, i) => {
        if (containedInstance.ref === undefined) {
            throw Error("Cannot find reference to instance");
        }

        serializedContains[i] = new Uint8Array(8);
        const instanceRef = instanceTable.get(containedInstance.ref.name);
        if (instanceRef === undefined) {
            throw Error("Cannot find reference to instance in table");
        }
        new DataView(serializedContains[i].buffer).setUint32(0, instanceRef);
        worldArray.set(serializedContains[i], (i*8)+worldArray[1]);
    });

    return {data: worldArray, length: worldArray.length};
}

function createMemory(main: Main): {mem: Uint8Array, animalTable: Map<string, number>, instanceTable: Map<string, number>, worldTable: Map<string, number>} {
    const animalTable = new Map<string, number>();
    const serializedAnimals = new Array<Uint8Array>(main.animals.length);

    let currentIndex = 0;

    main.animals.forEach((animal, i) => {
        const serializedAnimal = animalToBinary(animal);
        animalTable.set(animal.name, currentIndex);
        serializedAnimals[i] = serializedAnimal.data;

        currentIndex += serializedAnimal.length;
    });

    const instanceTable = new Map<string, number>();
    const serializedInstances = new Array<Uint8Array>(main.instances.length);

    main.instances.forEach((instance, i) => {
        const serializedInstance = instanceToBinary(instance, animalTable);
        instanceTable.set(instance.name, currentIndex);
        serializedInstances[i] = serializedInstance.data;

        currentIndex += serializedInstance.length;
    });

    const worldTable = new Map<string, number>();
    const serializedWorlds = new Array<Uint8Array>(main.worlds.length);

    main.worlds.forEach((world, i) => {
        const serializedWorld = worldToBinary(world, instanceTable);
        worldTable.set(world.name, currentIndex);
        serializedWorlds[i] = serializedWorld.data;

        currentIndex += serializedWorld.length;
    });

    // Fill up the buffer now that we know the length
    const mem = new Uint8Array(currentIndex);
    main.animals.forEach((animal, i) => {
        const offset = animalTable.get(animal.name);
        if (offset === undefined) {
            throw Error("undefined offset");
        }

        mem.set(serializedAnimals[i], offset);
    });

    main.instances.forEach((instance, i) => {
        const offset = instanceTable.get(instance.name);
        if (offset === undefined) {
            throw Error("undefined offset");
        }

        mem.set(serializedInstances[i], offset);
    });

    main.worlds.forEach((world, i) => {
        const offset = worldTable.get(world.name);
        if (offset === undefined) {
            throw Error("undefined offset");
        }

        mem.set(serializedWorlds[i], offset);
    });


    return {
        mem: mem,
        animalTable: animalTable,
        instanceTable: instanceTable,
        worldTable: worldTable
    };
}

export function generateWasm(main: Main, filePath: string, destination: string | undefined): string {
    const data = extractDestinationAndName(filePath, destination);
    const generatedFilePath = `${path.join(data.destination, data.name)}.wasm`;

    let memoryLayout = createMemory(main);

    const fileNode = new CompositeGeneratorNode();

    import('binaryen').then(function (binaryen) {
        const wasmModule = new binaryen.default.Module();
        wasmModule.setMemory(1, 256, "0", [
            {
                passive: false,
                offset: wasmModule.i32.const(10),
                data: memoryLayout.mem
            }
        ], false);
    
        // Optimize the module using default passes and levels
        wasmModule.optimize();
    
        // Validate the module
        if (!wasmModule.validate())
            throw new Error("validation error");
    
        // Generate text format
        var textData = wasmModule.emitText();
        console.log(textData);
    
        if (!fs.existsSync(data.destination)) {
            fs.mkdirSync(data.destination, { recursive: true });
        }
        fs.writeFileSync(generatedFilePath, toString(fileNode));
        return generatedFilePath; 
    }).catch(function(err) {
        console.log("error");
    });

    return "";
}
