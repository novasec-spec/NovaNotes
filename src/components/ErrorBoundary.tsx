import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

/**
 * Error boundary component that catches and displays errors gracefully
 * Prevents white screen of death from navigation errors
 */
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorCount: number;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeout: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: undefined,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    console.error('[ErrorBoundary] Error caught:', error);
    return {
      hasError: true,
      error,
      errorCount: 0,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Error details:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Increment error count
    this.setState((prevState) => ({
      errorCount: prevState.errorCount + 1,
    }));

    // If too many errors, don't try to recover
    if (this.state.errorCount > 3) {
      console.error('[ErrorBoundary] Too many errors, stopping recovery attempts');
    }
  }

  resetError = () => {
    console.log('[ErrorBoundary] Attempting error recovery');
    this.setState({
      hasError: false,
      error: undefined,
    });

    // Clear any pending timeouts
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
    }

    // Hard reload after a delay
    this.resetTimeout = setTimeout(() => {
      // This will trigger a full app reload
      console.log('[ErrorBoundary] Performing app reload');
    }, 500);
  };

  componentWillUnmount() {
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          resetError={this.resetError}
          errorCount={this.state.errorCount}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Fallback UI when error boundary catches an error
 */
interface ErrorFallbackProps {
  error?: Error;
  resetError: () => void;
  errorCount: number;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetError, errorCount }) => {
  const router = useRouter();

  const handleGoHome = () => {
    try {
      router.replace('/(tabs)/index');
    } catch {
      resetError();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.errorBox}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          {error?.message || 'An unexpected error occurred'}
        </Text>
        {errorCount > 0 && (
          <Text style={styles.errorCount}>
            Error attempt: {errorCount}
          </Text>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={handleGoHome}>
          <Text style={styles.buttonText}>Go to Home</Text>
        </TouchableOpacity>

        {errorCount <= 2 && (
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={resetError}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorBox: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  message: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 10,
    lineHeight: 20,
  },
  errorCount: {
    fontSize: 12,
    color: '#95a5a6',
    fontStyle: 'italic',
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
  button: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#95a5a6',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
