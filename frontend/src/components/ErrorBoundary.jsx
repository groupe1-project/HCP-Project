import React from 'react';

export default class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError() {
		return { hasError: true };
	}

	componentDidCatch(error, info) {
		// You may log the error to an external service here
		// console.error('ErrorBoundary caught:', error, info);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="p-6 bg-red-50 border-2 border-red-300 rounded-lg">
					<h3 className="text-lg font-bold text-red-700">Une erreur est survenue dans ce composant.</h3>
					<p className="text-sm text-gray-700">Rechargez la page ou contactez l'administrateur.</p>
				</div>
			);
		}

		return this.props.children;
	}
}

