import {useSearchParams} from 'react-router';

type FilterCheckboxProps = {
  param: 'color' | 'size' | 'vendor' | 'type' | string;
  value: string;
  label: string;
};

export function FilterCheckbox({param, value, label}: FilterCheckboxProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const selected = searchParams.getAll(param);

  const checked = selected.includes(value);

  function toggle() {
    const params = new URLSearchParams(searchParams);

    let values = params.getAll(param);

    if (values.includes(value)) {
      values = values.filter((v) => v !== value);
    } else {
      values.push(value);
    }

    params.delete(param);
    values.forEach((v) => params.append(param, v));

    setSearchParams(params);
  }

  return (
    <div className="flex items-start gap-2.5 mb-2">
      <input id={`input-${label.toLowerCase().replace(/\s+/g, '')}`}
        name={label.toLowerCase().replace(/\s+/g, '')} type="checkbox" checked={checked} onChange={toggle} />
      <label htmlFor={`input-${label.toLowerCase().replace(/\s+/g, '')}`}>
        {label}
      </label>
    </div>
  );
}