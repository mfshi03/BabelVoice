import React, { useState, ChangeEvent } from 'react';

interface DropdownProps {
  onLanguageChange: (selectedLanguage: string) => void;
}

const Dropdown: React.FC<DropdownProps> = ({ onLanguageChange }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('English');

  const languages: string[] = ['English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese', 'Korean'];

  const handleSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    const selectedLanguage = event.target.value;
    setSelectedLanguage(selectedLanguage);
    console.log(`Selected Language: ${selectedLanguage}`);
    onLanguageChange(selectedLanguage);
  };

  return (
    <div>
    <select
      value={selectedLanguage}
      onChange={handleSelect}
      className="bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded-lg shadow-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
    >
      {languages.map((language, index) => (
        <option key={index} value={language}>
          {language}
        </option>
      ))}
    </select>
  </div>
   
  );
};

export default Dropdown;
