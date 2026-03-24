import React from 'react';
import { useParams } from 'react-router-dom';

const ArtistPage = () => {
  const { artistName } = useParams<{ artistName: string }>();
  return (
    <div className="p-8 text-white">
      <h1 className="text-4xl font-bold">{artistName}</h1>
      <p>Artist page for {artistName} is under construction.</p>
    </div>
  );
};

export default ArtistPage;
