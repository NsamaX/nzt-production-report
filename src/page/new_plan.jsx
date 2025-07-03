import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const formatNum = (num) => {
    if (num === null || num === undefined || String(num).trim() === '') {
        return '';
    }
    const cleanedNum = String(num).replace(/,/g, '');
    const numVal = parseFloat(cleanedNum);
    return isNaN(numVal) ? cleanedNum : numVal.toLocaleString('en-US');
};

const parseNum = (str) => {
    if (str === null || str === undefined || String(str).trim() === '') {
        return '';
    }
    const cleanedStr = String(str).replace(/,/g, '');
    const numVal = parseInt(cleanedStr, 10);
    return isNaN(numVal) || numVal < 0 ? null : numVal;
};

const initialMod = {
    name: '',
    maxCapacity: null,
    displayMaxCapacity: '',
    data: []
};

function NewPlan({ onNavigate, user }) {
    const [lineName, setLineName] = useState('');
    const [desc, setDesc] = useState('');
    const [modList, setModList] = useState([{ ...initialMod }]);

    const [formErrors, setFormErrors] = useState({
        lineName: false,
        modList: false,
        modelCapacities: {}
    });

    const setFormError = (field, value) => {
        setFormErrors(prev => ({ ...prev, [field]: value }));
    };

    const setModCapError = (index, value) => {
        setFormErrors(prev => ({
            ...prev,
            modelCapacities: {
                ...prev.modelCapacities,
                [index]: value
            }
        }));
    };

    const handleModChange = (index, field, value) => {
        const newModList = [...modList];
        if (field === 'maxCapacity') {
            const cleanedVal = value.replace(/\D/g, '');
            newModList[index].maxCapacity = cleanedVal;
            newModList[index].displayMaxCapacity = formatNum(cleanedVal);

            const parsedVal = parseNum(cleanedVal);
            setModCapError(index, cleanedVal.trim() === '' || parsedVal === null);
        } else {
            newModList[index][field] = value;
            if (field === 'name' && value.trim() !== '') {
                setFormError('modList', newModList.some(m => m.name.trim() === ''));
            }
        }
        setModList(newModList);
    };

    const addMod = () => {
        setModList(prevModList => [...prevModList, { ...initialMod }]);
        setFormError('modList', false);
    };

    const removeMod = (index) => {
        const newModList = modList.filter((_, i) => i !== index);
        setModList(newModList);

        setFormErrors(prev => {
            const newModCapacities = {};
            Object.keys(prev.modelCapacities).forEach(key => {
                const originalIndex = parseInt(key);
                if (originalIndex < index) {
                    newModCapacities[originalIndex] = prev.modelCapacities[key];
                } else if (originalIndex > index) {
                    newModCapacities[originalIndex - 1] = prev.modelCapacities[key];
                }
            });
            return {
                ...prev,
                modList: newModList.length === 0,
                modelCapacities: newModCapacities
            };
        });
    };

    const validate = () => {
        let isValid = true;
        let newModCapErrors = {};
        let newModNameErrors = false;

        if (lineName.trim() === '') {
            setFormError('lineName', true);
            isValid = false;
        } else {
            setFormError('lineName', false);
        }

        if (modList.length === 0) {
            setFormError('modList', true);
            isValid = false;
        } else {
            setFormError('modList', false);
        }

        modList.forEach((model, index) => {
            if (model.name.trim() === '') {
                newModNameErrors = true;
                isValid = false;
            }

            const parsedCapacity = parseNum(model.maxCapacity);
            if (parsedCapacity === null) {
                newModCapErrors[index] = true;
                isValid = false;
            }
        });

        setFormError('modList', newModNameErrors || modList.length === 0);

        setFormErrors(prev => ({ ...prev, modelCapacities: newModCapErrors }));

        if (Object.keys(newModCapErrors).length > 0) {
            alert('Please specify the "Max Capacity" for each model correctly (must be a non-negative number).');
        }

        return isValid;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!validate()) {
            return;
        }

        const prodData = {
            plant: lineName,
            description: desc,
            models: modList.map(model => ({
                ...model,
                maxCapacity: parseNum(model.maxCapacity)
            })),
            createdAt: serverTimestamp(),
            createdBy: user?.uid || 'anonymous',
            createdByEmail: user?.email || 'anonymous',
        };

        try {
            const docRef = await addDoc(collection(db, 'productions'), prodData);
            alert('Production data saved successfully!');
            onNavigate('/dashboard');
        } catch (e) {
            console.error("Error adding document:", e);
            alert('An error occurred while saving data: ' + e.message);
        }
    };

    const canSubmit =
        lineName.trim() !== '' &&
        modList.length > 0 &&
        modList.every(model =>
            model.name.trim() !== '' &&
            parseNum(model.maxCapacity) !== '' &&
            parseNum(model.maxCapacity) !== null
        );

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
            <form
                onSubmit={handleSubmit}
                className="flex flex-col space-y-6 bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-2xl"
            >
                <h1 className="text-3xl font-extrabold text-center text-emerald-300 mb-4">
                    Add Production Data
                </h1>
                <div>
                    <label htmlFor="lineName" className="block text-gray-300 text-sm font-bold mb-2">
                        Production Line Name:
                    </label>
                    <input
                        id="lineName"
                        type="text"
                        placeholder="e.g., Production Line A"
                        value={lineName}
                        onChange={(e) => {
                            setLineName(e.target.value);
                            setFormError('lineName', e.target.value.trim() === '');
                        }}
                        onBlur={() => setFormError('lineName', lineName.trim() === '')}
                        className={`p-3 rounded-lg border bg-gray-700 text-white w-full
                            focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400
                            ${formErrors.lineName ? 'border-red-500' : 'border-emerald-700'}`}
                        required
                        aria-invalid={formErrors.lineName ? "true" : "false"}
                        aria-describedby={formErrors.lineName ? "plant-error" : undefined}
                    />
                    {formErrors.lineName && <p id="plant-error" className="text-red-400 text-sm mt-1">Please specify the production line name.</p>}
                </div>
                <div>
                    <label htmlFor="desc" className="block text-gray-300 text-sm font-bold mb-2">
                        Description:
                    </label>
                    <textarea
                        id="desc"
                        placeholder="Additional details about this production"
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                        rows="3"
                        className="p-3 rounded-lg border border-emerald-700 bg-gray-700 text-white w-full resize-y
                            focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                    ></textarea>
                </div>
                <div className={`border rounded-lg p-4 space-y-4 ${formErrors.modList || Object.values(formErrors.modelCapacities).some(e => e) ? 'border-red-500' : 'border-gray-600'}`}>
                    <h2 className="text-xl font-bold text-blue-400">Model List</h2>
                    {modList.map((model, index) => (
                        <div key={index} className="flex flex-col sm:flex-row sm:space-x-3 space-y-3 sm:space-y-0 items-end">
                            <div className="flex-grow-[2] w-full">
                                <label htmlFor={`modelName-${index}`} className="block text-gray-300 text-sm font-bold mb-1">
                                    Model Name {index + 1}:
                                </label>
                                <input
                                    id={`modelName-${index}`}
                                    type="text"
                                    placeholder="e.g., S/W"
                                    value={model.name}
                                    onChange={(e) => handleModChange(index, 'name', e.target.value)}
                                    className={`p-2 rounded-lg border bg-gray-700 text-white w-full
                                        focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400
                                        ${formErrors.modList && model.name.trim() === '' ? 'border-red-500' : 'border-gray-500'}`}
                                    required
                                />
                            </div>
                            <div className="flex-grow w-full">
                                <label htmlFor={`maxCapacity-${index}`} className="block text-gray-300 text-sm font-bold mb-1">
                                    Max Capacity:
                                </label>
                                <input
                                    id={`maxCapacity-${index}`}
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9,]*"
                                    placeholder="e.g., 10,000"
                                    value={model.displayMaxCapacity}
                                    onChange={(e) => handleModChange(index, 'maxCapacity', e.target.value)}
                                    onBlur={() => {
                                        const parsedVal = parseNum(model.displayMaxCapacity);
                                        const newModList = [...modList];
                                        newModList[index].maxCapacity = parsedVal !== null ? String(parsedVal) : '';
                                        newModList[index].displayMaxCapacity = formatNum(parsedVal !== null ? parsedVal : '');
                                        setModList(newModList);
                                        setModCapError(index, parsedVal === null);
                                    }}
                                    className={`p-2 rounded-lg border bg-gray-700 text-white w-full
                                        focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400
                                        ${formErrors.modelCapacities[index] ? 'border-red-500' : 'border-gray-500'}
                                        [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                                        [-moz-appearance:textfield]`}
                                    required
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => removeMod(index)}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg
                                         transition duration-300 ease-in-out transform hover:scale-105
                                         focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800 w-full sm:w-auto"
                            >
                                Delete
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addMod}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg w-full
                            transition duration-300 ease-in-out transform hover:scale-105
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                    >
                        Add Model Item
                    </button>
                    {formErrors.modList && modList.length === 0 && <p className="text-red-400 text-sm mt-1">Please add at least 1 model item.</p>}
                </div>
                <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 w-full justify-stretch mt-6">
                    <button
                        type="button"
                        onClick={() => onNavigate('/dashboard')}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6
                            rounded-lg transition duration-300 ease-in-out transform
                            hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex-1"
                    >
                        Back to Dashboard
                    </button>
                    <button
                        type="submit"
                        disabled={!canSubmit}
                        className={`font-bold py-4 px-6 rounded-lg transition duration-300 ease-in-out transform flex-1
                            ${canSubmit ? 'bg-emerald-600 hover:bg-emerald-700 hover:scale-105 focus:ring-emerald-500' : 'bg-gray-500 cursor-not-allowed'}
                            text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800`}
                    >
                        Create
                    </button>
                </div>
            </form>
        </div>
    );
}

export default NewPlan;
