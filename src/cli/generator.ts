import fs from 'fs';
import { CompositeGeneratorNode, toString } from 'langium';
import path from 'path';
import { Main, Animal, Instance, World } from '../language-server/generated/ast';
import { extractDestinationAndName } from './cli-util';
import binaryen from 'binaryen';

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
    new DataView(serializedSpeciesRef).setUint32(0, speciesRef);

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
        new DataView(serializedContains[i]).setUint32(0, instanceRef);
        worldArray.set(serializedContains[i], (i*8)+worldArray[1]);
    });

    return {data: worldArray, length: worldArray.length};
}

function createMemory(main: Main): {mem: Uint8Array, animalTable: Map<string, number>, instanceTable: Map<string, number>, worldTable: Map<string, number>} {
    const mem = new Uint8Array();

    
    
}

export function generateWasm(main: Main, filePath: string, destination: string | undefined): string {
    const data = extractDestinationAndName(filePath, destination);
    const generatedFilePath = `${path.join(data.destination, data.name)}.wasm`;

    const fileNode = new CompositeGeneratorNode();
    
    const wasmModule = new binaryen.Module();
    wasmModule.setMemory(1, 256, "0", [
        {
          passive: false,
          offset: wasmModule.i32.const(10),
          data: "hello, world".split('').map(function(x) { return x.charCodeAt(0) })
        }
    ], true);
    wasmModule.addMemoryExport("0", "0");

    
    
    

    if (!fs.existsSync(data.destination)) {
        fs.mkdirSync(data.destination, { recursive: true });
    }
    fs.writeFileSync(generatedFilePath, toString(fileNode));
    return generatedFilePath;
}
