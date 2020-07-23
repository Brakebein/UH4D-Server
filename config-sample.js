module.exports = {

	neo4j: {
		url: 'neo4j://localhost',
		user: 'user',
		password: 'pw',
		database: 'uh4d'
	},

	path: {
		data: 'C:/xampp/htdocs/UH4D-Data',
		tmp: 'C:/xampp/htdocs/DokuVisTmp'
	},

	proxy: 'http://host:port',

	exec: {
		ImagickConvert: "C:/ServerTools/ImageMagick-6.9.2-4-Q16-x64/convert.exe",
		ImagickMogrify: "C:/ServerTools/ImageMagick-6.9.2-4-Q16-x64/mogrify.exe",
		ImagickIdentify: "C:/ServerTools/ImageMagick-6.9.2-4-Q16-x64/identify.exe",
		CTMconv: "\"C:/Program Files (x86)/OpenCTM 1.0.3/bin/ctmconv.exe\"",
		Assimp: "C:/ServerTools/assimp_3.1.1_x64/assimp.exe",
		DLT: "C:/ServerTools/DLT/DLT.exe",
		CloudCompare: "C:/ServerTools/CloudCompare_v2.8.1_bin_x64/CloudCompare.exe",
		PotreeConv: "C:/ServerTools/PotreeConverter_1.5_windows_x64/PotreeConverter.exe"
	}

};
