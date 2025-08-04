import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Utility Functions
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
  data: [],
};

// NewPlan Component
function NewPlan({ onNavigate, user }) {
  // State
  const [lineName, setLineName] = useState('');
  const [desc, setDesc] = useState('');
  const [modList, setModList] = useState([{ ...initialMod }]);
  const [formErrors, setFormErrors] = useState({
    lineName: false,
    modList: false,
    modelCapacities: {},
  });

  // Error Handlers
  const setFormError = (field, value) => {
    setFormErrors((prev) => ({ ...prev, [field]: value }));
  };

  const setModCapError = (index, value) => {
    setFormErrors((prev) => ({
      ...prev,
      modelCapacities: { ...prev.modelCapacities, [index]: value },
    }));
  };

  // Model Handlers
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
      if (field === 'name') {
        setFormError('modList', newModList.some((m) => m.name.trim() === ''));
      }
    }
    setModList(newModList);
  };

  const addMod = () => {
    setModList((prevModList) => [...prevModList, { ...initialMod }]);
    setFormError('modList', false);
  };

  const removeMod = (index) => {
    const newModList = modList.filter((_, i) => i !== index);
    setModList(newModList);
    setFormErrors((prev) => {
      const newModCapacities = {};
      Object.keys(prev.modelCapacities).forEach((key) => {
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
        modelCapacities: newModCapacities,
      };
    });
  };

  // Validation
  const validate = () => {
    let isValid = true;
    let newModCapErrors = {};
    let newModNameErrors = false;

    // Validate line name
    setFormError('lineName', lineName.trim() === '');
    if (lineName.trim() === '') isValid = false;

    // Validate model list
    setFormError('modList', modList.length === 0);
    if (modList.length === 0) isValid = false;

    // Validate model names and capacities
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
    setFormErrors((prev) => ({ ...prev, modelCapacities: newModCapErrors }));

    if (Object.keys(newModCapErrors).length > 0) {
      alert(
        'Please specify the "Max Capacity" for each model correctly (must be a non-negative number).'
      );
    }

    return isValid;
  };

  // Form Submission
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    const prodData = {
      plant: lineName,
      description: desc,
      models: modList.map((model) => ({
        ...model,
        maxCapacity: parseNum(model.maxCapacity),
      })),
      createdAt: serverTimestamp(),
      createdBy: user?.uid || 'anonymous',
      createdByEmail: user?.email || 'anonymous',
    };

    try {
      await addDoc(collection(db, 'productions'), prodData);
      alert('Production data saved successfully!');
      onNavigate('/dashboard');
    } catch (error) {
      console.error('Error adding document:', error);
      alert(`An error occurred while saving data: ${error.message}`);
    }
  };

  const canSubmit =
    lineName.trim() !== '' &&
    modList.length > 0 &&
    modList.every(
      (model) =>
        model.name.trim() !== '' &&
        parseNum(model.maxCapacity) !== '' &&
        parseNum(model.maxCapacity) !== null
    );

  // Render
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4 text-white">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl space-y-6 rounded-xl bg-gray-800 p-8 shadow-lg"
      >
        {/* Header */}
        <h1 className="mb-4 text-center text-3xl font-extrabold text-emerald-300">
          Add Production Data
        </h1>

        {/* Production Line Name */}
        <div>
          <label
            htmlFor="lineName"
            className="mb-2 block text-sm font-bold text-gray-300"
          >
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
            className={`w-full rounded-lg border bg-gray-700 p-3 text-white 
                       placeholder-gray-400 focus:outline-none focus:ring-2 
                       focus:ring-blue-500
                       ${formErrors.lineName ? 'border-red-500' : 'border-emerald-700'}`}
            required
            aria-invalid={formErrors.lineName ? 'true' : 'false'}
            aria-describedby={formErrors.lineName ? 'plant-error' : undefined}
          />
          {formErrors.lineName && (
            <p id="plant-error" className="mt-1 text-sm text-red-400">
              Please specify the production line name.
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="desc" className="mb-2 block text-sm font-bold text-gray-300">
            Description:
          </label>
          <textarea
            id="desc"
            placeholder="Additional details about this production"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows="3"
            className="w-full resize-y rounded-lg border border-emerald-700 bg-gray-700 
                       p-3 text-white placeholder-gray-400 focus:outline-none 
                       focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Model List */}
        <div
          className={`space-y-4 rounded-lg border p-4
                     ${formErrors.modList || Object.values(formErrors.modelCapacities).some((e) => e)
                       ? 'border-red-500'
                       : 'border-gray-600'}`}
        >
          <h2 className="text-xl font-bold text-blue-400">Model List</h2>
          {modList.map((model, index) => (
            <div
              key={index}
              className="flex flex-col items-end space-y-3 sm:flex-row sm:space-x-3 sm:space-y-0"
            >
              <div className="w-full flex-grow-[2]">
                <label
                  htmlFor={`modelName-${index}`}
                  className="mb-1 block text-sm font-bold text-gray-300"
                >
                  Model Name {index + 1}:
                </label>
                <input
                  id={`modelName-${index}`}
                  type="text"
                  placeholder="e.g., S/W"
                  value={model.name}
                  onChange={(e) => handleModChange(index, 'name', e.target.value)}
                  className={`w-full rounded-lg border bg-gray-700 p-2 text-white 
                             placeholder-gray-400 focus:outline-none focus:ring-2 
                             focus:ring-emerald-500
                             ${formErrors.modList && model.name.trim() === '' ? 'border-red-500' : 'border-gray-500'}`}
                  required
                />
              </div>
              <div className="w-full flex-grow">
                <label
                  htmlFor={`maxCapacity-${index}`}
                  className="mb-1 block text-sm font-bold text-gray-300"
                >
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
                    newModList[index].displayMaxCapacity =
                      formatNum(parsedVal !== null ? parsedVal : '');
                    setModList(newModList);
                    setModCapError(index, parsedVal === null);
                  }}
                  className={`w-full rounded-lg border bg-gray-700 p-2 text-white 
                             placeholder-gray-400 focus:outline-none focus:ring-2 
                             focus:ring-emerald-500
                             ${formErrors.modelCapacities[index] ? 'border-red-500' : 'border-gray-500'}
                             [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none 
                             [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]`}
                  required
                />
              </div>
              <button
                type="button"
                onClick={() => removeMod(index)}
                className="w-full rounded-lg bg-red-600 px-4 py-2 font-bold text-white 
                          transition duration-300 ease-in-out transform hover:scale-105 
                          hover:bg-red-700 focus:outline-none focus:ring-2 
                          focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800 
                          sm:w-auto"
              >
                Delete
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addMod}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 font-bold text-white 
                      transition duration-300 ease-in-out transform hover:scale-105 
                      hover:bg-blue-700 focus:outline-none focus:ring-2 
                      focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            Add Model Item
          </button>
          {formErrors.modList && modList.length === 0 && (
            <p className="mt-1 text-sm text-red-400">Please add at least 1 model item.</p>
          )}
        </div>

        {/* Form Actions */}
        <div className="mt-6 flex w-full flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
          <button
            type="button"
            onClick={() => onNavigate('/dashboard')}
            className="flex-1 rounded-lg bg-blue-600 px-6 py-4 font-bold text-white 
                      transition duration-300 ease-in-out transform hover:scale-105 
                      hover:bg-blue-700 focus:outline-none focus:ring-2 
                      focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            Back to Dashboard
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className={`flex-1 rounded-lg px-6 py-4 font-bold text-white 
                       transition duration-300 ease-in-out transform focus:outline-none 
                       focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800
                       ${canSubmit
                         ? 'bg-emerald-600 hover:bg-emerald-700 hover:scale-105 focus:ring-emerald-500'
                         : 'cursor-not-allowed bg-gray-500'}`}
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}

export default NewPlan;
