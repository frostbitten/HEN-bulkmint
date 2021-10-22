import React, { useState } from 'react'
import { getLanguage } from '../../constants'
import { getMimeType } from '../../utils/sanitise'
import { readFileAsDataURL } from '../../utils/batch'
import styles from './styles.module.scss'

const Buffer = require('buffer').Buffer


export const UploadDir = ({
  label,
  allowedTypes,
  allowedTypesLabel,
  onChange = () => null,
}) => {
  const language = getLanguage()
  const [title, setTitle] = useState(label)

  const onFileChange = async (e) => {
	console.log('filechange:',e)
	const files = [...e.target.files].sort(function(a, b) {
		let f_a = a.webkitRelativePath.toUpperCase();
		let f_b = b.webkitRelativePath.toUpperCase();
		return (f_a < f_b) ? -1 : (f_a > f_b) ? 1 : 0;
	})
    // const file = files[0]
    // set reader for preview

	let filesReady = [];

	for( let file of files) {
		// setTitle(file.name)
		// const reader = new FileReader()
		const mimeType = file.type !== '' ? file.type : await getMimeType(file)
		const buffer = Buffer.from(await file.arrayBuffer())

		// reader.addEventListener('load', (e) => {
		  // onChange({ title:file.name, mimeType, file, buffer, reader: e.target.result })
		// })
		// await reader.readAsDataURL(file)
		// const readerData = await blobToDataURL(file);
		const readerData = URL.createObjectURL(file);
		filesReady.push({ title:file.name, mimeType, file, buffer, reader: readerData })
	}
	 onChange(filesReady)
  }

  const props = {
    type: 'file',
    name: 'file',
	
    webkitdirectory: true,
    directory: true,
    multiple: true,
  }

  if (allowedTypes) {
    props['accept'] = allowedTypes.join(',')
  }

  return (
    <div className={styles.container}>
      <label>
        {title}
        <input {...props} directory="" webkitdirectory="" onChange={onFileChange} />
      </label>
      <div className={styles.allowed}>
        {language.mint.supports}:&nbsp;{allowedTypesLabel}
      </div>
    </div>
  )
}
