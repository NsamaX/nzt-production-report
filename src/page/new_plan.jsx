import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const formatNumberWithCommas = (num) => {
    const cleanedNum = String(num).replace(/,/g, '');
    const numberValue = parseFloat(cleanedNum);
    return cleanedNum.trim() === '' || isNaN(numberValue) ? num : numberValue.toLocaleString('en-US');
};

const parseNumberFromFormattedString = (str) => {
    const cleanedStr = String(str).replace(/,/g, '');
    return parseInt(cleanedStr) || 0;
};

const initialModel = {
    name: '',
    maxCapacity: '',
    status: 'รอดำเนินการ',
    data: []
};

function NewPlan({ onNavigate, user, userRole }) {
    const [plant, setPlant] = useState('');
    const [description, setDescription] = useState('');
    const [responsiblePerson, setResponsiblePerson] = useState('');
    const [models, setModels] = useState([initialModel]);

    const [errors, setErrors] = useState({
        plant: false,
        responsiblePerson: false,
        models: false,
        modelCapacities: {}
    });

    const updateError = (field, value) => {
        setErrors(prev => ({ ...prev, [field]: value }));
    };

    const updateModelCapacityError = (index, value) => {
        setErrors(prev => ({
            ...prev,
            modelCapacities: {
                ...prev.modelCapacities,
                [index]: value
            }
        }));
    };

    const handleModelChange = (index, field, value) => {
        const newModels = [...models];
        if (field === 'maxCapacity') {
            newModels[index][field] = formatNumberWithCommas(value);
            const rawValue = parseNumberFromFormattedString(value);
            updateModelCapacityError(index, value.trim() === '' || isNaN(rawValue) || rawValue < 0);
        } else {
            newModels[index][field] = value;
            if (field === 'name' && value.trim() !== '') {
                updateError('models', models.some(m => m.name.trim() === ''));
            }
        }
        setModels(newModels);
        if (newModels.length > 0 && newModels.every(m => m.name.trim() !== '')) {
            updateError('models', false);
        }
    };

    const addModel = () => {
        setModels(prevModels => [...prevModels, { ...initialModel }]);
        updateError('models', false);
    };

    const removeModel = (index) => {
        const newModels = models.filter((_, i) => i !== index);
        setModels(newModels);

        setErrors(prev => {
            const newModelCapacities = {};
            Object.keys(prev.modelCapacities).forEach(key => {
                const originalIndex = parseInt(key);
                if (originalIndex < index) {
                    newModelCapacities[originalIndex] = prev.modelCapacities[key];
                } else if (originalIndex > index) {
                    newModelCapacities[originalIndex - 1] = prev.modelCapacities[key];
                }
            });
            return {
                ...prev,
                models: newModels.length === 0,
                modelCapacities: newModelCapacities
            };
        });
    };

    const validateForm = () => {
        let isValid = true;
        let newModelMaxCapacityErrors = {};

        if (plant.trim() === '') {
            updateError('plant', true);
            isValid = false;
        } else {
            updateError('plant', false);
        }

        if (responsiblePerson.trim() === '') {
            updateError('responsiblePerson', true);
            isValid = false;
        } else {
            updateError('responsiblePerson', false);
        }

        if (models.length === 0) {
            updateError('models', true);
            isValid = false;
        } else {
            updateError('models', false);
        }

        models.forEach((model, index) => {
            if (model.name.trim() === '') {
                isValid = false;
                alert('โปรดระบุชื่อรุ่นให้ครบถ้วน');
            }

            const parsedCapacity = parseNumberFromFormattedString(model.maxCapacity);
            if (model.maxCapacity.trim() === '' || isNaN(parsedCapacity) || parsedCapacity < 0) {
                newModelMaxCapacityErrors[index] = true;
                isValid = false;
            }
        });

        setErrors(prev => ({ ...prev, modelCapacities: newModelMaxCapacityErrors }));

        if (Object.keys(newModelMaxCapacityErrors).length > 0) {
            alert('โปรดระบุ "กำลังการผลิตสูงสุด" ของแต่ละรุ่นให้ถูกต้อง (ต้องเป็นตัวเลขที่ไม่ติดลบ)');
        }

        return isValid;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!validateForm()) {
            alert('โปรดกรอกข้อมูลที่จำเป็นให้ครบถ้วนและถูกต้อง');
            return;
        }

        const newProductionData = {
            plant,
            description,
            responsiblePerson,
            models: models.map(model => ({
                ...model,
                maxCapacity: parseNumberFromFormattedString(model.maxCapacity)
            })),
            createdAt: serverTimestamp(),
            createdBy: user?.uid || 'anonymous',
            createdByEmail: user?.email || 'anonymous',
        };

        try {
            const docRef = await addDoc(collection(db, 'productions'), newProductionData);
            console.log('Document written with ID:', docRef.id);
            alert('บันทึกข้อมูลการผลิตเรียบร้อยแล้ว!');
            onNavigate('/dashboard');
        } catch (e) {
            console.error("Error adding document:", e);
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + e.message);
        }
    };

    const canSubmit =
        plant.trim() !== '' &&
        responsiblePerson.trim() !== '' &&
        models.length > 0 &&
        models.every(model => model.name.trim() !== '' && !errors.modelCapacities[models.indexOf(model)]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
            <form
                onSubmit={handleSubmit}
                className="flex flex-col space-y-6 bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-2xl"
            >
                <h1 className="text-3xl font-extrabold text-center text-emerald-300 mb-4">
                    เพิ่มข้อมูลการผลิต
                </h1>
                <div>
                    <label htmlFor="plant" className="block text-gray-300 text-sm font-bold mb-2">
                        ชื่อสายการผลิต:
                    </label>
                    <input
                        id="plant"
                        type="text"
                        placeholder="เช่น สายการผลิต A"
                        value={plant}
                        onChange={(e) => {
                            setPlant(e.target.value);
                            updateError('plant', e.target.value.trim() === '');
                        }}
                        onBlur={() => updateError('plant', plant.trim() === '')}
                        className={`p-3 rounded-lg border bg-gray-700 text-white w-full
                            focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400
                            ${errors.plant ? 'border-red-500' : 'border-emerald-700'}`}
                        required
                        aria-invalid={errors.plant ? "true" : "false"}
                        aria-describedby={errors.plant ? "plant-error" : undefined}
                    />
                    {errors.plant && <p id="plant-error" className="text-red-400 text-sm mt-1">โปรดระบุชื่อสายการผลิต</p>}
                </div>
                <div>
                    <label htmlFor="responsiblePerson" className="block text-gray-300 text-sm font-bold mb-2">
                        ชื่อผู้รับผิดชอบ:
                    </label>
                    <input
                        id="responsiblePerson"
                        type="text"
                        placeholder="เช่น พี่น้อง"
                        value={responsiblePerson}
                        onChange={(e) => {
                            setResponsiblePerson(e.target.value);
                            updateError('responsiblePerson', e.target.value.trim() === '');
                        }}
                        onBlur={() => updateError('responsiblePerson', responsiblePerson.trim() === '')}
                        className={`p-3 rounded-lg border bg-gray-700 text-white w-full
                            focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400
                            ${errors.responsiblePerson ? 'border-red-500' : 'border-emerald-700'}`}
                        required
                        aria-invalid={errors.responsiblePerson ? "true" : "false"}
                        aria-describedby={errors.responsiblePerson ? "responsiblePerson-error" : undefined}
                    />
                    {errors.responsiblePerson && <p id="responsiblePerson-error" className="text-red-400 text-sm mt-1">โปรดระบุชื่อผู้รับผิดชอบ</p>}
                </div>
                <div>
                    <label htmlFor="description" className="block text-gray-300 text-sm font-bold mb-2">
                        คำอธิบาย:
                    </label>
                    <textarea
                        id="description"
                        placeholder="รายละเอียดเพิ่มเติมเกี่ยวกับการผลิตนี้"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows="3"
                        className="p-3 rounded-lg border border-emerald-700 bg-gray-700 text-white w-full resize-y
                            focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                    ></textarea>
                </div>
                <div className={`border rounded-lg p-4 space-y-4 ${errors.models || Object.values(errors.modelCapacities).some(e => e) ? 'border-red-500' : 'border-gray-600'}`}>
                    <h2 className="text-xl font-bold text-blue-400">รายการรุ่น</h2>
                    {models.map((model, index) => (
                        <div key={index} className="flex flex-col sm:flex-row sm:space-x-3 space-y-3 sm:space-y-0 items-end">
                            <div className="flex-grow-[2] w-full">
                                <label htmlFor={`modelName-${index}`} className="block text-gray-300 text-sm font-bold mb-1">
                                    ชื่อรุ่น {index + 1}:
                                </label>
                                <input
                                    id={`modelName-${index}`}
                                    type="text"
                                    placeholder="เช่น S/W"
                                    value={model.name}
                                    onChange={(e) => handleModelChange(index, 'name', e.target.value)}
                                    className={`p-2 rounded-lg border bg-gray-700 text-white w-full
                                        focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400
                                        ${errors.models && model.name.trim() === '' ? 'border-red-500' : 'border-gray-500'}`}
                                    required
                                />
                                {errors.models && model.name.trim() === '' && <p className="text-red-400 text-sm mt-1">โปรดระบุชื่อรุ่น</p>}
                            </div>
                            <div className="flex-grow w-full">
                                <label htmlFor={`maxCapacity-${index}`} className="block text-gray-300 text-sm font-bold mb-1">
                                    กำลังการผลิตสูงสุด:
                                </label>
                                <input
                                    id={`maxCapacity-${index}`}
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    placeholder="เช่น 10,000"
                                    value={model.maxCapacity}
                                    onChange={(e) => handleModelChange(index, 'maxCapacity', e.target.value)}
                                    onKeyPress={(e) => {
                                        const charCode = e.which ? e.which : e.keyCode;
                                        if (!(charCode >= 48 && charCode <= 57) && charCode !== 8 && charCode !== 37 && charCode !== 39) {
                                            e.preventDefault();
                                        }
                                    }}
                                    className={`p-2 rounded-lg border bg-gray-700 text-white w-full
                                        focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400
                                        ${errors.modelCapacities[index] ? 'border-red-500' : 'border-gray-500'}
                                        [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                                        [-moz-appearance:textfield]`}
                                    required
                                />
                                {errors.modelCapacities[index] && <p className="text-red-400 text-sm mt-1">โปรดระบุตัวเลขกำลังการผลิตสูงสุดที่ถูกต้อง</p>}
                            </div>
                            <button
                                type="button"
                                onClick={() => removeModel(index)}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg
                                    transition duration-300 ease-in-out transform hover:scale-105
                                    focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800 w-full sm:w-auto"
                            >
                                ลบ
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addModel}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg w-full
                            transition duration-300 ease-in-out transform hover:scale-105
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                    >
                        เพิ่มรายการรุ่น
                    </button>
                    {errors.models && models.length === 0 && <p className="text-red-400 text-sm mt-1">โปรดเพิ่มรายการรุ่นอย่างน้อย 1 รายการ</p>}
                    {models.length > 0 && models.some(item => item.name.trim() === '') && (
                        <p className="text-red-400 text-sm mt-1">โปรดระบุชื่อรุ่นให้ครบถ้วน</p>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 w-full justify-stretch mt-6">
                    <button
                        type="button"
                        onClick={() => onNavigate('/dashboard')}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6
                            rounded-lg transition duration-300 ease-in-out transform
                            hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex-1"
                    >
                        กลับสู่แผงควบคุม
                    </button>
                    <button
                        type="submit"
                        disabled={!canSubmit}
                        className={`font-bold py-4 px-6 rounded-lg transition duration-300 ease-in-out transform flex-1
                            ${canSubmit ? 'bg-emerald-600 hover:bg-emerald-700 hover:scale-105 focus:ring-emerald-500' : 'bg-gray-500 cursor-not-allowed'}
                            text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800`}
                    >
                        บันทึกข้อมูล
                    </button>
                </div>
            </form>
        </div>
    );
}

export default NewPlan;
